import { supabase } from "../config/supabase.js";

export const TransactionModel = {
  // Buat transaksi baru
  async create({ user_id, product_id, quantity, total_price }) {
    return await supabase
      .from("transactions")
      .insert([{ user_id, product_id, quantity, total_price, is_paid: false }])
      .select()
      .single();
  },

  // Ambil detail transaksi by ID
  async findById(id) {
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        *,
        products (
          product_name, category, image
        )
      `)
      .eq("id", id)
      .single();
    return { data, error };
  },

  // Update status bayar
  async markAsPaid(id) {
    return await supabase
      .from("transactions")
      .update({ is_paid: true })
      .eq("id", id)
      .select()
      .single();
  },

  // Ambil history user
  async getHistory(userId) {
    const { data, error } = await supabase
      .from("transactions")
      .select(`
        id, total_price, quantity, is_paid, created_at,
        products (product_name, category, price)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { data, error };
  },

  // Log activity (Checkout Pending / Purchase Success)
  async logBehavior(userId, type, dataPayload) {
    return await supabase.from("user_behaviors").insert([{
      user_id: userId,
      behavior_type: type,
      data: dataPayload
    }]);
  }
};