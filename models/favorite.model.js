import { supabase } from "../config/supabase.js";

export const FavoriteModel = {
  // Cek apakah produk sudah di-like user ini?
  async findOne(userId, productId) {
    const { data, error } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();
    return { data, error };
  },

  // Tambah Favorit
  async add(userId, productId) {
    return await supabase
      .from("favorites")
      .insert([{ user_id: userId, product_id: productId }]);
  },

  // Hapus Favorit
  async remove(id) {
    return await supabase
      .from("favorites")
      .delete()
      .eq("id", id);
  },

  // Ambil semua favorit user (plus join product)
  async getByUser(userId) {
    const { data, error } = await supabase
      .from("favorites")
      .select(`
        id, product_id,
        products (
          id, product_name, category, price, description, image, type
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    return { data, error };
  }
};