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

// --- 3. LOGIC: USAGE SCORE CALCULATOR ---
const calculateUsageStats = (transactions, favorites, surveyData) => {
  let gamingScore = 0;
  let videoScore = 0;
  let socialScore = 0;

  const addScore = (category, weight) => {
    const cat = category?.toLowerCase() || "";
    if (cat.includes('game') || cat.includes('mlbb')) gamingScore += weight;
    else if (cat.includes('stream') || cat.includes('movie') || cat.includes('video') || cat.includes('youtube')) videoScore += weight;
    else if (cat.includes('sosmed') || cat.includes('chat')) socialScore += weight;
    else socialScore += (weight / 2); // General category
  };

  // Scoring Rules
  transactions.forEach(t => addScore(t.products?.category, 10)); // Transaksi: Bobot 10
  favorites.forEach(f => addScore(f.products?.category, 5));     // Favorit: Bobot 5
  
  // Survey Score
  const usageInterest = surveyData.survey_usage || [];
  if (usageInterest.includes('gaming')) gamingScore += 5;
  if (usageInterest.includes('streaming')) videoScore += 5;
  if (usageInterest.includes('social')) socialScore += 5;

  // Konversi ke Fitur ML
  const totalAllScores = gamingScore + videoScore + socialScore;
  const dataUsage = 2.0 + (totalAllScores * 1.0); // Base 2GB + (Score * 1GB)
  const pctVideo = totalAllScores === 0 ? 0.1 : parseFloat((videoScore / totalAllScores).toFixed(2));

  return { dataUsage, pctVideo };
};

// --- 4. MAIN EXPORT FUNCTION ---
export const recalculateUserProfile = async (userId) => {
  console.log(`[ML-Update] Menghitung ulang profil User ID: ${userId}...`);

  try {
    // 1. Fetch Data
    const { transactions, favorites, surveyData } = await fetchUserData(userId);

    // 2. Calculate Stats
    const { monthlySpend, totalTransactions } = calculateFinancialStats(transactions, surveyData);
    const { dataUsage, pctVideo } = calculateUsageStats(transactions, favorites, surveyData);

    // 3. Prepare Payload
    const planType = monthlySpend > 150000 ? "Postpaid" : "Prepaid";
    
    const mlPayload = {
      user_id: userId,
      plan_type: planType,
      device_brand: "Generic", 
      avg_data_usage_gb: parseFloat(dataUsage.toFixed(1)),
      pct_video_usage: pctVideo,
      avg_call_duration: 10.0,
      sms_freq: 5,
      monthly_spend: parseFloat(monthlySpend.toFixed(2)),
      topup_freq: Math.max(1, totalTransactions),
      travel_score: 0.1,
      complaint_count: 0,
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