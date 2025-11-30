import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_APP_KEY,
  },
});

export async function sendOTPEmail(to, otp) {
  try {
    await transporter.sendMail({
      from: `"OTP System" <${process.env.EMAIL_SENDER}>`,
      to,
      subject: "Kode OTP Anda",
      text: `Kode OTP Anda adalah: ${otp}`,
    });
    console.log(`Email OTP terkirim ke ${to}`);
  } catch (err) {
    console.error("Email error:", err);
  }
}