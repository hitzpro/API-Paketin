import { UserModel } from "../models/user.model.js";
import { BehaviorModel } from "../models/behavior.model.js";
import { hashPassword } from "../utils/hash.util.js";
import { createNotification } from "./notifications.controller.js";
import { recalculateUserProfile } from "../utils/mlUpdate.js";

// 1. Get Profile
export const getUser = async (req, res) => {
  try {
    const { data: user, error } = await UserModel.findById(req.params.id);

    if (error || !user || user.is_active === false) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    return res.status(200).json({ user });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// 2. Update Profile
export const updateUser = async (req, res) => {
  try {
    const { user_id, name, email, profile_picture, password } = req.body;
    if (!user_id) return res.status(400).json({ message: "User ID wajib." });

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (profile_picture) updates.profile_picture = profile_picture;
    if (password) updates.password = hashPassword(password);

    const { data, error } = await UserModel.update(user_id, updates);
    if (error) throw error;

    createNotification(user_id, "Profil Diperbarui", "Data berhasil disimpan.", "info");
    return res.json({ message: "Data user diperbarui", user: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 3. Delete User
export const deleteUser = async (req, res) => {
  try {
    const { user_id, username_confirmation } = req.body;
    if (!user_id || !username_confirmation) return res.status(400).json({ message: "Data tidak lengkap." });

    const { data: user } = await UserModel.findById(user_id);
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    if (user.name !== username_confirmation) {
        return res.status(400).json({ message: "Nama konfirmasi tidak cocok." });
    }

    const { error } = await UserModel.softDelete(user_id);
    if (error) throw error;

    return res.json({ message: "Akun dinonaktifkan." });
  } catch (err) {
    return res.status(500).json({ message: "Gagal hapus akun.", detail: err.message });
  }
};

// 4. Submit Survey & Train ML
export const submitSurveyAndTrain = async (req, res) => {
  try {
    const { user_id, survey_usage, survey_budget, source } = req.body;
    
    if (!user_id) return res.status(400).json({ message: "User ID wajib." });
    const parsedId = parseInt(user_id);

    // Simpan Log (jika bukan skip)
    if (source !== 'skip') {
        const { error } = await BehaviorModel.saveSurvey(parsedId, { survey_usage, survey_budget });
        if (error) throw error;
    }

    // Trigger ML & Notif
    await recalculateUserProfile(parsedId);
    createNotification(user_id, "Terima Kasih!", "Survey tersimpan.", "success");

    return res.status(200).json({ success: true, message: "Profil ML diperbarui." });
  } catch (err) {
    console.error("[Survey Error]", err);
    return res.status(500).json({ message: "Gagal proses survey", error: err.message });
  }
};