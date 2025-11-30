export const requireUserAndProduct = (req, res, next) => {
    const { user_id, product_id } = req.body;
    
    if (!user_id || !product_id) {
      return res.status(400).json({ message: "User ID dan Product ID wajib ada." });
    }
    next();
  };