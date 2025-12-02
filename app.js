import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv"; 

dotenv.config(); 

// Import Routes
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/products.routes.js";
import favoriteRoutes from "./routes/favorites.routes.js";
import transactionRoutes from "./routes/transactions.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import otpRoutes from "./routes/otp.routes.js";
import notificationRoutes from "./routes/notifications.routes.js";
import recommendationRoutes from "./routes/recommendations.routes.js";

const app = express();

// --- CONFIG CORS (UPDATE) ---
app.use(cors({
    origin: function (origin, callback) {
        // 1. Izinkan request tanpa origin (Server-to-Server, Postman, Mobile Apps)
        if (!origin) return callback(null, true);

        // 2. List URL Localhost yang diizinkan
        const allowedLocal = [
            "http://localhost:4321",
            "http://127.0.0.1:4321"
        ];

        // 3. Ambil URL Utama dari .env
        const envClientUrl = process.env.CLIENT_URL;

        // --- LOGIKA PENGECEKAN ---
        
        // A. Cek Localhost
        if (allowedLocal.includes(origin)) {
            return callback(null, true);
        }

        // B. Cek URL Utama (Production)
        if (envClientUrl && origin === envClientUrl) {
            return callback(null, true);
        }

        // C. [SOLUSI ERROR KAMU] Izinkan semua subdomain Vercel
        // Ini akan mengizinkan: 
        // - https://paketin.vercel.app
        // - https://paketin-my-id-2noe.vercel.app (URL Preview kamu)
        if (origin.endsWith(".vercel.app")) {
            return callback(null, true);
        }

        // Jika tidak ada yang cocok, blokir
        console.error(`BLOCKED CORS ORIGIN: ${origin}`); 
        return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true, // Wajib true agar cookie bisa lewat
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- ROUTES ---
// Health Check
app.get("/", (req, res) => {
    res.json({
        message: "Paketin API is Running! 🚀",
        server_time: new Date().toISOString()
    });
});

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