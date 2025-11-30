import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

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

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:4321";

// --- MIDDLEWARE ---
const allowedOrigins = [
    CLIENT_URL,
    "http://127.0.0.1:4321"
  ];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS Policy Error'), false);
        }
        return callback(null, true);
    },
    credentials: true,
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

// Route campuran di root (bisa dirapikan nanti jika mau, misal jadi /auth/...)
app.use("/", authRoutes);
app.use("/", transactionRoutes);
app.use("/", otpRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan." });
});

export default app;