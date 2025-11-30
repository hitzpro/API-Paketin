import express from "express";
import * as productController from "../controllers/products.controller.js";

const router = express.Router();

router.get("/", productController.getProducts);
router.get("/cheapest", productController.getCheapestProducts);
router.get("/similar/:id", productController.getSimilarProducts);

export default router;