import jwt from "jsonwebtoken";
import User from "../../models/User.js";

export async function requireAuth(req, res, next) {
  try 
  {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Chưa đăng nhập" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: "Token không hợp lệ" });

    req.user = user;
    next();
  } 
  catch (err) 
  {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn" });
    }
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}
