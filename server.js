import dotenv from "dotenv";
import app from "./app.js"; // Import app yang sudah dikonfigurasi

dotenv.config();

const PORT = process.env.PORT || 3200;

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan rapi di http://localhost:${PORT}`);
});