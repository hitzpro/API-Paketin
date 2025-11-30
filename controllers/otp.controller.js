import { UserModel } from "../models/user.model.js"; // Gunakan Model yg sudah ada
import { supabase } from "../config/supabase.js"; // Untuk OTP check manual
import { hashPassword } from "../utils/hash.util.js";
import { sendOTPEmail } from "../services/email.service.js";
import { createNotification } from "./notifications.controller.js";

// 1. Verify OTP
export const verifyOtp = async (req, res) => {
  const { phone_number, otp } = req.body;
  
  // Reuse logic findByPhone dari UserModel
  const { data: user } = await UserModel.findByPhone(Number(phone_number));
  
  if (!user) return res.status(400).json({ message: "Nomor telepon tidak ditemukan." });

  const { data: otpData } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("user_id", user.id)
    .eq("otp_code", otp)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!otpData) return res.status(400).json({ message: "OTP salah." });
  
  // Fix Date Parsing (Safari/Node compatibility)
  const expiredTime = new Date(otpData.expired_at).getTime();
  if (Date.now() > expiredTime) return res.status(400).json({ message: "OTP kadaluarsa." });

  // Cleanup & Verify
  await supabase.from("otp_codes").delete().eq("id", otpData.id);
  await supabase.from("users").update({ is_verified: true }).eq("id", user.id);

  createNotification(user.id, "Akun Terverifikasi", "Selamat! Akun Anda aktif.", "success");

  return res.status(200).json({ message: "Verifikasi berhasil!", verified: true });
};

// 2. Resend OTP
export const resendOtp = async (req, res) => {
  let { phone_number } = req.body;
  const { data: user } = await UserModel.findByPhone(Number(phone_number));
  
  if (!user) return res.status(400).json({ message: "User tidak ditemukan." });
  if (user.is_verified) return res.status(400).json({ message: "Akun sudah diverifikasi." });

  // Hapus OTP lama & Buat baru
  await supabase.from("otp_codes").delete().eq("user_id", user.id);
  const newOtp = String(Math.floor(100000 + Math.random() * 900000));
  
  await UserModel.saveOTP(user.id, newOtp);
  sendOTPEmail(user.email, newOtp);

  return res.status(200).json({ message: "OTP baru telah dikirim.", resend: true });
};

// 3. Cancel OTP
export const cancelOtp = async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: "user_id wajib dikirim." });
    
    // Set expired immediately
    await supabase.from("otp_codes").update({ expired_at: new Date().toISOString() }).eq("user_id", user_id);
    return res.status(200).json({ message: "OTP dibatalkan." });
};

// 4. Update Unverified User
export const updateUnverified = async (req, res) => {
    const { user_id, phone_number, email, name, password } = req.body;
  
    if (!user_id) return res.status(400).json({ message: "user_id wajib dikirim." });
  
    const { data: user } = await supabase.from("users").select("*").eq("id", user_id).maybeSingle();
  
    if (!user) return res.status(404).json({ message: "User tidak ditemukan." });
    if (user.is_verified) return res.status(400).json({ message: "User sudah terverifikasi." });
  
    const payload = { phone_number, email, name };
    if (password) payload.password = hashPassword(password);
  
    await supabase.from("users").update(payload).eq("id", user_id);
  
    return res.status(200).json({ message: "Data user diperbarui." });
};

// 5. REQUEST RESET PASSWORD (BY EMAIL)
export const forgotPasswordRequest = async (req, res) => {
  const { email } = req.body;

  if (!email) {
      return res.status(400).json({ message: "Email wajib diisi." });
  }

  // 1. Cari User by Email
  const { data: user } = await UserModel.findByEmail(email);

  if (!user) return res.status(404).json({ message: "Email tidak terdaftar." });
  if (user.is_active === false) return res.status(403).json({ message: "Akun dinonaktifkan." });

  // 2. Bersihkan OTP lama & Buat Baru
  await supabase.from("otp_codes").delete().eq("user_id", user.id);
  
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await UserModel.saveOTP(user.id, otp); // Helper ini sudah ada di model kan?
  
  // 3. Kirim Email
  sendOTPEmail(user.email, otp);

  return res.json({ message: "Kode OTP telah dikirim ke email Anda." });
};

// 6. RESET PASSWORD (VERIFY & CHANGE)
export const forgotPasswordReset = async (req, res) => {
  const { email, otp, new_password } = req.body;

  if (!email || !otp || !new_password) {
      return res.status(400).json({ message: "Data tidak lengkap." });
  }

  // 1. Cari User lagi
  const { data: user } = await UserModel.findByEmail(email);
  if (!user) return res.status(404).json({ message: "User tidak ditemukan." });

  // 2. Cek OTP di Database
  const { data: otpData } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("otp_code", otp)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (!otpData) return res.status(400).json({ message: "Kode OTP salah." });

  const expiredTime = new Date(otpData.expired_at).getTime();
  if (Date.now() > expiredTime) return res.status(400).json({ message: "Kode OTP kadaluarsa." });

  // 3. Update Password
  const hashedPassword = hashPassword(new_password);
  await UserModel.update(user.id, { password: hashedPassword });
  
  // 4. Bersihkan OTP
  await supabase.from("otp_codes").delete().eq("id", otpData.id);

  // 5. Notifikasi
  createNotification(user.id, "Password Diubah", "Password akun Anda berhasil direset.", "warning");

  return res.json({ message: "Password berhasil diubah!", success: true });
};