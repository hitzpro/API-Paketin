import { ProductModel } from "../models/product.model.js";

// Load dummy data sekali saja saat server start
const dummyProducts = [
  {
      "id": 1,
      "product_name": "Pulsa Hemat 20rb",
      "category": "Top-up Promo",
      "price": 19500,
      "type": "CREDIT",
      "image": "https://placehold.co/400x300?text=Pulsa"
  }
];

// 1. Get All Products
export const getProducts = async (req, res) => {
  const { data, error } = await ProductModel.findAll();
  
  // Fallback ke dummy jika DB kosong/error
  if (error || !data || data.length === 0) {
    return res.status(200).json({ source: "dummy", data: dummyProducts });
  }
  return res.status(200).json({ source: "supabase", data });
};

// 2. Get Cheapest / Filtered Products
export const getCheapestProducts = async (req, res) => {
  try {
    const { category } = req.query;
    const { data, error } = await ProductModel.findCheapest(category);

    if (error) throw error;
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 3. Get Similar Products
export const getSimilarProducts = async (req, res) => {
  try {
    const { id } = req.params;

    // Ambil info produk saat ini
    const { data: current, error: fetchError } = await ProductModel.findById(id);
    if (fetchError || !current) {
      return res.status(404).json({ message: "Produk tidak ditemukan" });
    }

    // Logic Range Harga (±50%)
    const minPrice = current.price * 0.5;
    const maxPrice = current.price * 1.5;

    // Cari produk serupa
    let { data: similar, error } = await ProductModel.findSimilar({
      category: current.category,
      type: current.type,
      minPrice,
      maxPrice,
      excludeId: id
    });

    if (error) throw error;

    // Fallback: Jika hasil < 2, cari berdasarkan kategori saja (abaikan harga)
    if (!similar || similar.length < 2) {
       const fallback = await ProductModel.findSimilarFallback({
         category: current.category,
         excludeId: id
       });
       return res.json({ data: fallback.data || [] });
    }

    return res.json({ data: similar });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};