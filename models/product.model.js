import { supabase } from "../config/supabase.js";

export const ProductModel = {
  // Ambil semua produk
  async findAll() {
    return await supabase.from("products").select("*");
  },

  // Ambil satu produk by ID
  async findById(id) {
    const { data, error } = await supabase
      .from("products")
      .select("category, type, price")
      .eq("id", id)
      .single();
    return { data, error };
  },

  // Query produk termurah dengan filter pintar (Type vs Category)
  async findCheapest(categoryFilter) {
    let query = supabase.from("products").select("*").order("price", { ascending: true });

    if (categoryFilter) {
      const lowerCat = categoryFilter.toLowerCase();
      
      // Cek apakah filter merujuk ke Tipe (Pulsa/Kuota) atau Kategori spesifik
      if (['pulsa', 'credit'].includes(lowerCat)) {
        query = query.eq("type", "CREDIT");
      } else if (['kuota', 'data'].includes(lowerCat)) {
        query = query.eq("type", "DATA");
      } else {
        query = query.ilike("category", categoryFilter);
      }
    }
    return await query;
  },

  // Query produk serupa berdasarkan range harga
  async findSimilar({ category, type, minPrice, maxPrice, excludeId, limit = 4 }) {
    return await supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .eq("type", type)
      .neq("id", excludeId)
      .gte("price", minPrice)
      .lte("price", maxPrice)
      .limit(limit);
  },

  // Fallback jika tidak ada yang mirip di range harga
  async findSimilarFallback({ category, excludeId, limit = 4 }) {
    return await supabase
      .from("products")
      .select("*")
      .eq("category", category)
      .neq("id", excludeId)
      .limit(limit);
  }
};