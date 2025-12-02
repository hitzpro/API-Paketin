import { supabase } from "../config/supabase.js";

/**
 * UTILS: Machine Learning Feature Engineer
 * Bertugas mengolah data mentah user (Survey, Transaksi, Favorit)
 * menjadi fitur statistik yang siap dikonsumsi Model ML.
 */

// --- 1. DATA FETCHER HELPER ---
const fetchUserData = async (userId) => {
  // Ambil Transaksi Sukses
  const { data: transactions } = await supabase
    .from("transactions")
    .select("total_price, product_id, products(category)")
    .eq("user_id", userId)
    .eq("is_paid", true);

  // Ambil Data Favorit
  const { data: favorites } = await supabase
    .from("favorites")
    .select("products(category)")
    .eq("user_id", userId);

  // Ambil Survey Terakhir
  const { data: surveyLogs } = await supabase
    .from("user_behaviors")
    .select("data")
    .eq("user_id", userId)
    .eq("behavior_type", "onboarding_survey")
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    transactions: transactions || [],
    favorites: favorites || [],
    surveyData: surveyLogs?.[0]?.data || {}
  };
};

// --- 2. LOGIC: FINANCIAL STATS CALCULATOR ---
const calculateFinancialStats = (transactions, surveyData) => {
  const totalTransactions = transactions.length;
  
  // A. Default Value dari Survey (Cold Start)
  let monthlySpend = 25000; 
  if (surveyData.survey_budget === 'sultan') monthlySpend = 500000;
  else if (surveyData.survey_budget === 'sedang') monthlySpend = 100000;

  // B. Override dengan Data Real (Jika ada transaksi)
  if (totalTransactions > 0) {
    const totalSpend = transactions.reduce((sum, t) => sum + parseFloat(t.total_price), 0);
    const avgSpend = totalSpend / totalTransactions;
    const maxSpend = transactions.reduce((max, t) => Math.max(max, parseFloat(t.total_price)), 0);

    // Ambil nilai paling optimis (Max Spend atau Average) agar profil user naik kelas
    monthlySpend = Math.max(avgSpend, maxSpend);

    // Boost jika pernah beli mahal (>75rb)
    if (maxSpend >= 75000) {
        monthlySpend = Math.max(monthlySpend, 160000); 
    }
  }

  return { monthlySpend, totalTransactions };
};

// --- 3. LOGIC: USAGE SCORE CALCULATOR (UPDATED BERDASARKAN ANALISIS MODEL) ---
const calculateUsageStats = (transactions, favorites, surveyData) => {
  let gamingScore = 0;
  let videoScore = 0;
  let socialScore = 0;
  
  // Variable baru untuk fitur penting lainnya
  let callScore = 10.0; // Default rata-rata (menit)
  let travelScore = 0.1; // Default rendah (skala 0-10 atau 0.0-1.0)
  let complaintScore = 0; // Default

  const addScore = (category, weight) => {
    const cat = category?.toLowerCase() || "";
    
    // 1. Video Usage (Fitur Penting #3)
    if (cat.includes('stream') || cat.includes('movie') || cat.includes('video') || cat.includes('youtube') || cat.includes('netflix')) {
        videoScore += weight;
    }
    // 2. Gaming Usage
    else if (cat.includes('game') || cat.includes('mlbb')) {
        gamingScore += weight;
    }
    // 3. Social Usage
    else if (cat.includes('sosmed') || cat.includes('chat') || cat.includes('social')) {
        socialScore += weight;
    }
    // 4. Travel Score (Fitur Penting #4)
    else if (cat.includes('roaming') || cat.includes('travel') || cat.includes('sg') || cat.includes('hajj')) {
        travelScore += (weight / 10); // Nambah sedikit demi sedikit (misal 0.5)
    }
    // 5. Call Duration (Fitur Penting #1)
    else if (cat.includes('voice') || cat.includes('nelpon') || cat.includes('talk')) {
        callScore += (weight * 5); // Nambah 50 menit per pembelian
    }
  };

  // Scoring Rules
  transactions.forEach(t => addScore(t.products?.category, 10)); // Transaksi: Bobot Besar
  favorites.forEach(f => addScore(f.products?.category, 5));     // Favorit: Bobot Sedang
  
  // Survey Score
  const usageInterest = surveyData.survey_usage || [];
  if (usageInterest.includes('gaming')) gamingScore += 5;
  if (usageInterest.includes('streaming')) videoScore += 5;
  if (usageInterest.includes('social')) socialScore += 5;
  if (usageInterest.includes('work')) {
      callScore += 30; // Asumsi kerja butuh nelpon
      travelScore += 0.2; // Asumsi kerja kadang travel
  }

  // --- KONVERSI KE FITUR ML ---
  
  // Data Usage
  const totalAllScores = gamingScore + videoScore + socialScore;
  const dataUsage = 2.0 + (totalAllScores * 1.0); 

  // pct_video_usage (Juara 3)
  const pctVideo = totalAllScores === 0 ? 0.1 : parseFloat((videoScore / totalAllScores).toFixed(2));
  
  // Normalisasi Travel Score (Maks 10.0 biar masuk akal)
  const finalTravelScore = Math.min(travelScore, 10.0);

  return { 
      dataUsage, 
      pctVideo, 
      avgCallDuration: callScore, 
      travelScore: finalTravelScore,
      complaintCount: complaintScore 
  };
};

// --- 4. MAIN EXPORT FUNCTION ---
export const recalculateUserProfile = async (userId) => {
  console.log(`[ML-Update] Menghitung ulang profil User ID: ${userId}...`);

  try {
    // 1. Fetch Data
    const { transactions, favorites, surveyData } = await fetchUserData(userId);

    // 2. Calculate Stats
    const { monthlySpend, totalTransactions } = calculateFinancialStats(transactions, surveyData);
        
    // Ambil return value baru
    const { dataUsage, pctVideo, avgCallDuration, travelScore, complaintCount } = calculateUsageStats(transactions, favorites, surveyData);

    // 3. Prepare Payload
    // Logic Plan Type (Juara 2) diperkuat
    const planType = monthlySpend > 100000 ? "Postpaid" : "Prepaid";

    const mlPayload = {
      user_id: userId,
      plan_type: planType, // Fitur Penting #2
      device_brand: "Generic", 
      avg_data_usage_gb: parseFloat(dataUsage.toFixed(1)), // Fitur Penting #7
      pct_video_usage: pctVideo, // Fitur Penting #3
      avg_call_duration: parseFloat(avgCallDuration.toFixed(1)), // Fitur Penting #1 (Kita manipulasi ini!)
      sms_freq: 5,             // Fitur Penting #8
      monthly_spend: parseFloat(monthlySpend.toFixed(2)), // Fitur Penting #6
      topup_freq: Math.max(1, totalTransactions),
      travel_score: parseFloat(travelScore.toFixed(2)), // Fitur Penting #4
      complaint_count: complaintCount, // Fitur Penting #5
      updated_at: new Date()
    };

    console.log("[ML-Update] Payload Baru:", mlPayload);
    
    // 4. Save to DB
    const { error } = await supabase
      .from("customer_ml_features")
      .upsert(mlPayload, { onConflict: "user_id" });

    if (error) throw error;
    console.log("[ML-Update] Sukses update feature store!");

  } catch (err) {
    console.error("[ML-Update] Error:", err.message);
  }
};