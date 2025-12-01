import { supabase } from "../config/supabase.js";
import { ProductModel } from "../models/product.model.js";

// const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:5000/predict";
const ML_API_URL = process.env.ML_API_URL || "https://ml-paketin-production.up.railway.app/predict";

export const getPersonalizedRecommendation = async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. AMBIL DATA FITUR USER
    const { data: userFeatures, error: featureError } = await supabase
      .from("customer_ml_features")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (featureError || !userFeatures) {
      // Fallback User Baru (Belum ada data ML)
      // Kita ambil produk General Offer sebagai default
      const fallback = await ProductModel.findSimilarFallback({ category: 'General Offer', limit: 4 });
      return res.json({ source: "default_fallback", data: fallback.data || [] });
    }

    // 2. SANITASI DATA (PENTING!)
    // Pastikan tidak ada null yang dikirim ke Python
    const payload = {
        plan_type: userFeatures.plan_type || "Prepaid",
        device_brand: userFeatures.device_brand || "Generic",
        avg_data_usage_gb: Number(userFeatures.avg_data_usage_gb) || 0,
        pct_video_usage: Number(userFeatures.pct_video_usage) || 0,
        avg_call_duration: Number(userFeatures.avg_call_duration) || 0,
        sms_freq: Number(userFeatures.sms_freq) || 0,
        monthly_spend: Number(userFeatures.monthly_spend) || 0,
        topup_freq: Number(userFeatures.topup_freq) || 0,
        travel_score: Number(userFeatures.travel_score) || 0,
        complaint_count: Number(userFeatures.complaint_count) || 0
    };

    console.log(`[Recom] Sending to ML: Spend=${payload.monthly_spend}`);

    // 3. KIRIM KE ML
    let mlResult = null;
    try {
        const mlRes = await fetch(ML_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!mlRes.ok) {
             const errText = await mlRes.text();
             throw new Error(`ML Server Error: ${mlRes.status} - ${errText}`);
        }
        mlResult = await mlRes.json();
    } catch (mlErr) {
        console.error("ML Connection Failed:", mlErr.message);
        // Jangan matikan proses, lanjut ke Logic Override/Fallback manual
    }
    
    let label = mlResult ? mlResult.label_prediction : 'General Offer';

    // 4. LOGIKA OVERRIDE (Sultan Check)
    const spend = parseFloat(payload.monthly_spend);
    if (label === 'General Offer') {
        if (spend >= 150000) label = 'High Value';
        else if (spend >= 75000) label = 'Data Booster';
        else if (spend < 25000) label = 'Top-up Promo';
    }

    console.log(`[Recom] Final Label: ${label}`);

    // 5. AMBIL PRODUK UTAMA
    const { data: mainProducts } = await supabase
        .from("products")
        .select("*")
        .eq("category", label);

    let finalProducts = mainProducts || [];

    // 6. LOGIKA FALLBACK PINTAR (Isi Kekurangan)
    if (finalProducts.length < 4) {
        const currentIds = finalProducts.map(p => p.id);
        // Tambahkan dummy ID 0 jika array kosong agar query SQL valid
        const excludeIds = currentIds.length > 0 ? `(${currentIds.join(',')})` : `(0)`; 
        
        const needed = 4 - finalProducts.length;
        const targetPrice = spend || 50000;

        const { data: similarProducts } = await supabase
            .from("products")
            .select("*")
            .not("id", "in", excludeIds)
            .gte("price", targetPrice * 0.6)
            .lte("price", targetPrice * 1.4)
            .limit(needed);
            
        if (similarProducts && similarProducts.length > 0) {
            finalProducts = [...finalProducts, ...similarProducts];
        }
        
        // Lapis terakhir: Ambil apa saja
        if (finalProducts.length < 4) {
             const stillNeeded = 4 - finalProducts.length;
             const allCurrentIds = finalProducts.map(p => p.id);
             const excludeAll = allCurrentIds.length > 0 ? `(${allCurrentIds.join(',')})` : `(0)`;

             const { data: fillers } = await supabase
                .from("products")
                .select("*")
                .not("id", "in", excludeAll)
                .limit(stillNeeded);
                
             finalProducts = [...finalProducts, ...(fillers || [])];
        }
    }

    // 7. SORTING TYPE PREFERENCE
    const { data: lastTrx } = await supabase
        .from('transactions')
        .select(`products (type)`)
        .eq('user_id', userId)
        .eq('is_paid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const preferredType = lastTrx?.products?.type;
    
    if (preferredType && finalProducts.length > 0) {
        finalProducts.sort((a, b) => {
            if (a.type === preferredType && b.type !== preferredType) return -1;
            if (a.type !== preferredType && b.type === preferredType) return 1;
            return 0;
        });
    }

    return res.json({
      source: mlResult ? "ml_recommendation" : "logic_fallback",
      prediction: label,
      data: finalProducts
    });

  } catch (error) {
    console.error("Critical Recom Error:", error);
    // Fallback Total (Safe Mode)
    // Pastikan parameter category ada agar query model valid
    const fallback = await ProductModel.findSimilarFallback({ category: 'General Offer', limit: 4 });
    return res.json({ source: "error_fallback", data: fallback.data || [] });
  }
};