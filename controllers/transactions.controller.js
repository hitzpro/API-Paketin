import { TransactionModel } from "../models/transaction.model.js";
import { ProductModel } from "../models/product.model.js"; // Import Product Model
import { createNotification } from "./notifications.controller.js";
import { recalculateUserProfile } from "../utils/mlUpdate.js";

// 1. Create Checkout
export const createCheckout = async (req, res) => {
  try {
    const { user_id, product_id, quantity } = req.body;

    if (!user_id || !product_id || !quantity) {
      return res.status(400).json({ error: "Data checkout tidak lengkap." });
    }

    // Ambil harga produk (via ProductModel)
    const productData = await ProductModel.findById(product_id);
    if (!productData.data) return res.status(400).json({ error: "Produk tidak ditemukan" });

    const total_price = parseFloat(productData.data.price) * parseInt(quantity);

    // Insert Transaksi (via TransactionModel)
    const { data: trx, error } = await TransactionModel.create({
      user_id, product_id, quantity, total_price
    });

    if (error) throw error;

    // Log Behavior
    await TransactionModel.logBehavior(user_id, "checkout_pending", {
      transaction_id: trx.id, product_id, total: total_price
    });

    createNotification(user_id, "Tagihan Baru", `Segera bayar tagihan #${trx.id}`, "info");

    return res.json({
      message: "Checkout created",
      checkout_id: trx.id,
      redirect_qr: `/checkout/${trx.id}/qrcode`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 2. Get Payment Status
export const getPaymentStatus = async (req, res) => {
  try {
    const { data: trx, error } = await TransactionModel.findById(req.params.id);
    
    if (error || !trx) return res.status(404).json({ error: "Transaksi tidak ditemukan" });

    return res.json({
      checkout_id: trx.id,
      is_paid: trx.is_paid,
      total_price: trx.total_price,
      product_name: trx.products?.product_name,
      category: trx.products?.category,
      created_at: trx.created_at
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 3. Pay Transaction
export const payTransaction = async (req, res) => {
  const { checkout_id } = req.body;
  if (!checkout_id) return res.status(400).json({ error: "checkout_id wajib." });

  try {
    const { data: trx, error } = await TransactionModel.markAsPaid(checkout_id);
    
    if (error || !trx) throw error;

    // Log Success
    await TransactionModel.logBehavior(trx.user_id, "purchase_success", {
      transaction_id: trx.id,
      product_id: trx.product_id,
      total_price: trx.total_price,
      method: "qrcode_simulation"
    });

    // TRIGGER ML UPDATE
    recalculateUserProfile(trx.user_id);

    createNotification(trx.user_id, "Pembayaran Berhasil!", `Transaksi #${trx.id} lunas.`, "success");

    return res.json({ message: "Pembayaran berhasil!", success: true, data: trx });

  } catch (err) {
    return res.status(500).json({ message: "Gagal bayar", error: err.message });
  }
};

// 4. Get QR Code
export const getQrCode = async (req, res) => {
  const { id } = req.params;

  const clientUrl = process.env.CLIENT_URL || "http://localhost:4321";
  
  // Arahkan ke halaman konfirmasi bayar di Frontend
  const scanUrl = `${clientUrl}/pay-confirm/${id}`;
  
  return res.json({
    checkout_id: id,
    scan_url: scanUrl
  });
};

// 5. Get History
export const getHistory = async (req, res) => {
  try {
    const { data, error } = await TransactionModel.getHistory(req.params.user_id);
    if (error) throw error;
    return res.json({ message: "Riwayat diambil", data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};