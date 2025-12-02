import dotenv from "dotenv";
import app from "./app.js"; // Import app yang sudah dikonfigurasi

dotenv.config();

const PORT = process.env.PORT || 3200;

if (process.env.VERCEL) {
  console.log("🚀 Running on Vercel Serverless");
} else {
  app.listen(PORT, () => {
      console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

// PENTING: Export app untuk Vercel
export default app;