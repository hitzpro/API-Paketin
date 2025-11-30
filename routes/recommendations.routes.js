import express from "express";
import * as recController from "../controllers/recommendations.controller.js";

const router = express.Router();

router.get("/:userId", recController.getPersonalizedRecommendation);

export default router;