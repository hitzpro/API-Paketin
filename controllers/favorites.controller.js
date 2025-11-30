import { FavoriteModel } from "../models/favorite.model.js";
import { recalculateUserProfile } from "../utils/mlUpdate.js";

export const toggleFavorite = async (req, res) => {
  const { user_id, product_id } = req.body;

  try {
    // 1. Cek Existing via Model
    const { data: existing } = await FavoriteModel.findOne(user_id, product_id);

    if (existing) {
      // HAPUS
      await FavoriteModel.remove(existing.id);
      recalculateUserProfile(user_id); // Trigger ML
      return res.json({ message: "Dihapus dari favorit", is_favorited: false });
    } else {
      // TAMBAH
      await FavoriteModel.add(user_id, product_id);
      recalculateUserProfile(user_id); // Trigger ML
      return res.json({ message: "Ditambahkan ke favorit!", is_favorited: true });
    }
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getFavorites = async (req, res) => {
  const { user_id } = req.params;

  try {
    const { data, error } = await FavoriteModel.getByUser(user_id);
    
    if (error) throw error;

    // Formatting Data (Flattening)
    const formattedData = data.map(item => item.products).filter(p => p !== null);

    return res.json({ data: formattedData });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};