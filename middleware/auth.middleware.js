export const validateRegister = (req, res, next) => {
    const { phone_number, email, name, password } = req.body;
  
    if (!phone_number || !email || !name || !password) {
      return res.status(400).json({ message: "Semua field (HP, Email, Nama, Pass) wajib diisi." });
    }
  
    if (isNaN(Number(phone_number))) {
      return res.status(400).json({ message: "Format nomor telepon harus angka." });
    }
  
    next(); // Lanjut ke Controller
  };
  
  export const validateLogin = (req, res, next) => {
    const { phone_number, password } = req.body;
  
    if (!phone_number || !password) {
      return res.status(400).json({ message: "Nomor HP dan Password wajib diisi." });
    }
  
    next(); // Lanjut ke Controller
  };