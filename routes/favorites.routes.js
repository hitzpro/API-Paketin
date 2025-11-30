import express from "express";
import * as favController from "../controllers/favorites.controller.js";
import { requireUserAndProduct } from "../middleware/general.middleware.js"; // Import Middleware

const router = express.Router();

// Pasang Middleware validasi
router.post("/toggle", requireUserAndProduct, favController.toggleFavorite);
router.get("/:user_id", favController.getFavorites);

export default router;