import { Router } from "express";
import * as authService from "../../services/authService.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// Đăng ký route auth tại app.js, nên ở đây chỉ cần định nghĩa các endpoint liên quan đến auth mà thôi
// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Mật khẩu tối thiểu 6 ký tự" });
    }

    const { user, token } = await authService.register({
      username,
      email,
      password,
    });
    res.status(201).json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Đăng nhập và lấy token
// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin" });
    }

    const { user, token } = await authService.login({ email, password });
    res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/me  — lấy thông tin người dùng hiện tại
router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
