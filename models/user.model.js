import { supabase } from "../config/supabase.js";

export const UserModel = {
    // Cari user berdasarkan email
    async findByEmail(email) {
        const { data, error } = await supabase
        .from("users")
        .select("id, email, name, password, phone_number")
        .eq("email", email)
        .maybeSingle();
        return { data, error };
    },

    // Cari user berdasarkan no HP
    async findByPhone(phone) {
        const { data, error } = await supabase
        .from("users")
        .select("*") // Ambil semua field termasuk password hash
        .eq("phone_number", phone)
        .maybeSingle();
        return { data, error };
    },

    // Buat user baru
    async create(userData) {
        const { data, error } = await supabase
        .from("users")
        .insert([userData])
        .select()
        .single();
        return { data, error };
    },

    // Simpan OTP
    async saveOTP(userId, otp) {
        return await supabase.from("otp_codes").insert([
        { 
            user_id: userId, 
            otp_code: otp, 
            expired_at: new Date(Date.now() + 5 * 60 * 1000) 
        }
        ]);
    },

    // Ambil profil user
    async findById(id) {
        const { data, error } = await supabase
        .from("users")
        .select("id, phone_number, email, name, is_verified, is_active, profile_picture")
        .eq("id", id)
        .maybeSingle();
        return { data, error };
    },

    // Update profil
    async update(id, updates) {
        const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", id)
        .select("id, name, email, phone_number, profile_picture")
        .single();
        return { data, error };
    },

    // Soft delete user
    async softDelete(id) {
        return await supabase
        .from("users")
        .update({ is_active: false })
        .eq("id", id);
    }

};