import { supabase } from "../config/supabase.js";
import { ProductModel } from "../models/product.model.js";

const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:5000/predict";

export const getPersonalizedRecommendation = async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. AMBIL DATA FITUR USER (Untuk ML)
    const { data: userFeatures, error: featureError } = await supabase
      .from("customer_ml_features")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (featureError || !userFeatures) {
      const fallback = await ProductModel.findSimilarFallback({ limit: 4 });
      return res.json({ source: "default_fallback", data: fallback.data || [] });
    }

    // 2. PROSES ML (LONG TERM MEMORY)
    // Menentukan "Kelas" User (Sultan/Hemat/Gamer)
    const payload = { ...userFeatures };
    delete payload.id; delete payload.user_id; delete payload.updated_at;

    // Sanitasi data number
    for (let key in payload) {
        if (typeof userFeatures[key] === 'number') payload[key] = Number(userFeatures[key]) || 0;
    }

    let mlResult = null;
    try {
        const mlRes = await fetch(ML_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (mlRes.ok) mlResult = await mlRes.json();
    } catch (mlErr) {
        console.error("ML Error:", mlErr.message);
    }
    
    let label = mlResult ? mlResult.label_prediction : 'General Offer';

    // Override Logic (Sultan Check) - Tetap dipakai untuk menentukan "Kelas"
    const spend = parseFloat(payload.monthly_spend);
    if (label === 'General Offer') {
        if (spend >= 150000) label = 'High Value';
        else if (spend >= 75000) label = 'Data Booster';
        else if (spend < 25000) label = 'Top-up Promo';
    }

    // 3. ANALISIS TRANSAKSI TERAKHIR (SHORT TERM CONTEXT) --- BAGIAN BARU ---
    // Kita lihat apa yang BARUSAN dibeli user
    const { data: lastTrx } = await supabase
        .from('transactions')
        .select(`
            id, created_at, total_price,
            products (id, type, category, price, product_name)
        `)
        .eq('user_id', userId)
        .eq('is_paid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    let contextProducts = [];
    
    if (lastTrx && lastTrx.products) {
        const lastProd = lastTrx.products;
        const lastPrice = parseFloat(lastTrx.total_price); // Harga yang dia bayar terakhir

        console.log(`[Recom] Konteks Terakhir: Beli ${lastProd.product_name} (${lastProd.type}) seharga ${lastPrice}`);

        // QUERY PINTAR: Cari produk yang MIRIP dengan pembelian terakhir
        // Syarat: 
        // 1. Tipe SAMA (Kalau beli Pulsa, tawarin Pulsa. Beli Data, tawarin Data)
        // 2. Harga MIRIP (Range 50% - 200% dari harga terakhir). 
        //    Contoh: Beli 10rb -> Tawarin 5rb s/d 20rb. (Jangan tawarin 500rb dulu)
        
        const minPrice = lastPrice * 0.5;
        const maxPrice = lastPrice * 2.0;

        const { data: similarLast } = await supabase
            .from("products")
            .select("*")
            .eq("type", lastProd.type) // Prioritas Tipe
            .gte("price", minPrice)
            .lte("price", maxPrice)
            .neq("id", lastProd.id) // Jangan tawarin produk yg sama persis barusan dibeli
            .limit(4);

        if (similarLast) contextProducts = similarLast;
    }

    // 4. AMBIL PRODUK DARI ML (LONG TERM)
    const { data: mlProducts } = await supabase
        .from("products")
        .select("*")
        .eq("category", label)
        .limit(6); // Ambil agak banyak buat cadangan

    // 5. PENGGABUNGAN (MERGE STRATEGY)
    // Urutan Prioritas:
    // 1. Produk yang mirip pembelian terakhir (Context)
    // 2. Produk dari prediksi ML (Persona)
    
    let combined = [...contextProducts, ...(mlProducts || [])];

    // Hapus Duplikat (Filter Unique ID)
    const uniqueProducts = [];
    const seenIds = new Set();

    for (const p of combined) {
        if (!seenIds.has(p.id)) {
            uniqueProducts.push(p);
            seenIds.add(p.id);
        }
    }

    // Ambil 6 teratas (misal frontend minta 4, kita kasih lebih dikit)
    const finalResult = uniqueProducts.slice(0, 6);

    return res.json({
      source: contextProducts.length > 0 ? "hybrid_context" : "ml_recommendation",
      prediction: label, // Tetap kirim label asli user (misal High Value)
      context_based_on: lastTrx?.products?.product_name || "None",
      data: finalResult
    });

  } catch (error) {
    console.error("Critical Recom Error:", error);
    const fallback = await ProductModel.findSimilarFallback({ category: 'General Offer', limit: 4 });
    return res.json({ source: "error_fallback", data: fallback.data || [] });
  }
};