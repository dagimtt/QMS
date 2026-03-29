import express from "express";
import { login, refreshToken, logout, getMe } from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.get("/me", authenticateToken, getMe);

export default router;