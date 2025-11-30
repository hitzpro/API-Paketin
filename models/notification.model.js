import { supabase } from "../config/supabase.js";

export const NotificationModel = {
  async create({ userId, title, message, type = 'info' }) {
    return await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type
    });
  },

  async getByUser(userId, from, to) {
    const { data, error, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);
    return { data, error, count };
  },

  async markAsRead(id) {
    return await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  },

  async delete(id) {
    return await supabase.from("notifications").delete().eq("id", id);
  }
};