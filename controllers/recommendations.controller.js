import { supabase } from "../config/supabase.js";
import { ProductModel } from "../models/product.model.js"; // Gunakan model agar rapi

const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:5000/predict";

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
      const fallback = await ProductModel.findSimilarFallback({ limit: 4 });
      return res.json({ source: "default_fallback", data: fallback.data });
    }

    // 2. KIRIM KE ML
    const payload = { ...userFeatures };
    delete payload.id; delete payload.user_id; delete payload.updated_at;

    const mlRes = await fetch(ML_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!mlRes.ok) throw new Error("ML Server Error");
    const mlResult = await mlRes.json();
    let label = mlResult.label_prediction;

    // 3. LOGIKA OVERRIDE (SULTAN CHECK)
    const spend = parseFloat(userFeatures.monthly_spend);
    if (label === 'General Offer') {
        if (spend >= 150000) label = 'High Value';
        else if (spend >= 75000) label = 'Data Booster';
        else if (spend < 25000) label = 'Top-up Promo';
    }

    // 4. AMBIL PRODUK UTAMA
    const { data: mainProducts } = await supabase
        .from("products")
        .select("*")
        .eq("category", label);

    let finalProducts = mainProducts || [];

    // 5. LOGIKA FALLBACK PINTAR (Jika < 4 produk)
    if (finalProducts.length < 4) {
        const currentIds = finalProducts.map(p => p.id);
        const needed = 4 - finalProducts.length;
        const targetPrice = spend || 50000; // Pakai spend user sebagai acuan

        // Cari produk tambahan yang harganya mirip (±40%) dan bukan produk yg sudah ada
        const { data: similarProducts } = await supabase
            .from("products")
            .select("*")
            .not("id", "in", `(${currentIds.join(',')})`) // Exclude yg sudah ada
            .gte("price", targetPrice * 0.6)
            .lte("price", targetPrice * 1.4)
            .limit(needed);
            
        if (similarProducts && similarProducts.length > 0) {
            finalProducts = [...finalProducts, ...similarProducts];
        }
        
        // Jika masih kurang, ambil random best seller (termahal di kategori umum)
        if (finalProducts.length < 4) {
            const stillNeeded = 4 - finalProducts.length;
            const { data: fillers } = await supabase
                .from("products")
                .select("*")
                .eq("category", "General Offer")
                .limit(stillNeeded);
            finalProducts = [...finalProducts, ...(fillers || [])];
        }
    }

    // 6. CEK TIPE TRANSAKSI TERAKHIR (Sorting Preference)
    // Jika user terakhir beli Pulsa, taruh produk Pulsa di urutan awal array
    const { data: lastTrx } = await supabase
        .from('transactions')
        .select(`products (type)`)
        .eq('user_id', userId)
        .eq('is_paid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const preferredType = lastTrx?.products?.type;
    
    if (preferredType) {
        finalProducts.sort((a, b) => {
            if (a.type === preferredType && b.type !== preferredType) return -1;
            if (a.type !== preferredType && b.type === preferredType) return 1;
            return 0;
        });
    }

    return res.json({
      source: "ml_recommendation",
      prediction: label,
      data: finalProducts
    });

  } catch (error) {
    console.error("Recom Error:", error.message);
    const fallback = await ProductModel.findSimilarFallback({ limit: 4 });
    return res.json({ source: "error_fallback", data: fallback.data });
  }
};