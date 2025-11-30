import { UserModel } from "../models/user.model.js";
import { supabase } from "../config/supabase.js"; 
import { hashPassword } from "../utils/hash.util.js";
import { sendOTPEmail } from "../services/email.service.js";
import { createNotification } from "./notifications.controller.js";

// --- REGISTER ---
export const register = async (req, res) => {
  try {
    // Input sudah divalidasi oleh Middleware, langsung pakai
    let { phone_number, email, name, password } = req.body;
    phone_number = Number(phone_number);

    // 1. Cek Duplikat via Model
    const emailCheck = await UserModel.findByEmail(email);
    if (emailCheck.data) return res.status(400).json({ message: "Email sudah terdaftar." });

    const phoneCheck = await UserModel.findByPhone(phone_number);
    if (phoneCheck.data) return res.status(400).json({ message: "Nomor telepon sudah terdaftar." });

    // 2. Create User via Model
    const hashed = hashPassword(password);
    const { data: newUser, error } = await UserModel.create({
      phone_number, email, name, password: hashed, is_verified: false
    });

    if (error) throw error;

    // 3. OTP & Email
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await UserModel.saveOTP(newUser.id, otp);
    sendOTPEmail(email, otp);
    
    createNotification(newUser.id, "Selamat Datang!", `Halo ${name}, silahkan verifikasi akun.`, "success");

    return res.status(200).json({ message: "Registrasi berhasil!", user_id: newUser.id });

  } catch (err) {
    return res.status(500).json({ message: "Register error", detail: err.message });
  }
};

// --- LOGIN ---
export const login = async (req, res) => {
  try {
    let { phone_number, password } = req.body;
    
    // 1. Cek User via Model
    const hashed = hashPassword(password);
    const { data: user } = await UserModel.findByPhone(Number(phone_number));

    // Validasi Password & Status
    if (!user || user.password !== hashed) {
        return res.status(401).json({ message: "Nomor telepon atau password salah." });
    }
    if (!user.is_active) return res.status(403).json({ message: "Akun dinonaktifkan." });
    if (!user.is_verified) return res.status(403).json({ message: "Akun belum diverifikasi." });

    // 2. Cek Survey (Logic khusus Supabase langsung gpp, atau buat BehaviorModel)
    const { data: survey } = await supabase
        .from("user_behaviors")
        .select("id")
        .eq("user_id", user.id)
        .eq("behavior_type", "onboarding_survey")
        .limit(1)
        .maybeSingle();
      
    // 3. Set Cookie
    res.cookie("user_id", String(user.id), {
      httpOnly: false, secure: false, sameSite: "lax", path: "/", maxAge: 86400000 
    });

    return res.status(200).json({ 
        message: "Login berhasil!", 
        user: { id: user.id, name: user.name, email: user.email, profile_picture: user.profile_picture }, 
        needs_onboarding: !survey 
    });

  } catch (err) {
    return res.status(500).json({ message: "Login error", error: err.message });
  }
};

// --- LOGOUT ---
export const logout = async (req, res) => {
  try {
      const user_id = req.body.user_id || req.cookies?.user_id;

      if (user_id) {
        supabase.from("user_behaviors").insert([{ 
            user_id: parseInt(user_id), 
            behavior_type: "user_logout", 
            data: { timestamp: new Date().toISOString() } 
        }]).then(() => {});
      }

      // Force Delete Cookie
      res.setHeader('Set-Cookie', [
        `user_id=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
      ]);

      return res.json({ message: "Logout berhasil", logout: true });
  } catch (err) {
      return res.status(500).json({ message: "Logout error", error: err.message });
  }
};