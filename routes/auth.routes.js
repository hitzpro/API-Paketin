import express from "express";
import * as authController from "../controllers/auth.controller.js";
import { validateRegister, validateLogin } from "../middleware/auth.middleware.js"; // Import Middleware

const router = express.Router();

// Pasang Middleware sebelum Controller
router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.post("/logout", authController.logout);

export default router;