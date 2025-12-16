import express from "express";
import * as otpController from "../controllers/otp.controller.js";

const router = express.Router();

router.post("/verify-otp", otpController.verifyOtp);
router.post("/resend-otp", otpController.resendOtp);
router.post("/cancel-otp", otpController.cancelOtp);
router.post("/update-unverified", otpController.updateUnverified);
router.post("/forgot-password/request", otpController.forgotPasswordRequest);
router.post("/forgot-password/reset", otpController.forgotPasswordReset);
router.post("/simulate-otp", otpController.getOtpSimulation); 

export default router;