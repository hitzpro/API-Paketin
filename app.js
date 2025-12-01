import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv"; // Import dotenv

// AKTIFKAN DOTENV DI SINI JUGA
dotenv.config(); 

// Import semua Routes
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/products.routes.js";
import favoriteRoutes from "./routes/favorites.routes.js";
import transactionRoutes from "./routes/transactions.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import notificationRoutes from "./routes/notifications.routes.js";
import recommendationRoutes from "./routes/recommendations.routes.js";

const app = express();

// --- CONFIG CORS YANG LEBIH KUAT ---
// Kita masukkan semua variasi localhost agar aman
const allowedOrigins = [
    "http://localhost:4321",      // Frontend via localhost
    "http://127.0.0.1:4321",      // Frontend via IP
    process.env.CLIENT_URL        // Dari .env (jika ada)
].filter(Boolean); // Hapus nilai null/undefined jika env belum diset

app.use(cors({
    origin: function (origin, callback) {
        // Izinkan request dari server-to-server (seperti Postman) yang tidak punya origin
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            console.error(`BLOCKED BY CORS: ${origin}`); // Log biar tau siapa yang diblokir
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true, // Wajib true
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- ROUTES ---
app.use("/products", productRoutes);
app.use("/favorites", favoriteRoutes);
app.use("/user", profileRoutes);
app.use("/recommendations", recommendationRoutes);
app.use("/notifications", notificationRoutes);

app.use("/", authRoutes);
app.use("/", transactionRoutes);
app.use("/", otpRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: "Endpoint tidak ditemukan." });
});

export default app;