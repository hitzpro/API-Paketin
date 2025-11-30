import express from "express";
import * as trxController from "../controllers/transactions.controller.js";

const router = express.Router();

router.post("/checkout/create", trxController.createCheckout);
router.get("/checkout/:id/qrcode", trxController.getQrCode);
router.get("/payment/status/:id", trxController.getPaymentStatus);
router.post("/payment/pay", trxController.payTransaction);
router.get("/transactions/history/:user_id", trxController.getHistory);

export default router;