import express from "express";
import * as profileController from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/:id", profileController.getUser);
router.put("/update", profileController.updateUser);
router.delete("/delete", profileController.deleteUser);
router.post("/update-profile-ml", profileController.submitSurveyAndTrain);

export default router;