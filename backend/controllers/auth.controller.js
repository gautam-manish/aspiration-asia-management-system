import jwt from "jsonwebtoken";

// ─────────────────────────────────────────
// Admin credentials — username is fixed; password comes from .env
// ─────────────────────────────────────────
const ADMIN_USERNAME = "admin";

// ─────────────────────────────────────────
// @desc    Login Admin
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        const JWT_SECRET     = process.env.JWT_SECRET;

        if (!JWT_SECRET) {
            console.error("[auth] JWT_SECRET is not set in environment");
            return res.status(500).json({
                success: false,
                message: "Server configuration error. Contact administrator.",
            });
        }
        if (!ADMIN_PASSWORD) {
            console.error("[auth] ADMIN_PASSWORD is not set in environment");
            return res.status(500).json({
                success: false,
                message: "Server configuration error. Contact administrator.",
            });
        }

        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required",
            });
        }

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password",
            });
        }

        const token = jwt.sign(
            { username, role: "admin" },
            JWT_SECRET,
            { expiresIn: "8h" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
        });
    } catch (error) {
        console.error("[auth] login error:", error);
        return res.status(500).json({ success: false, message: "Login failed. Please try again." });
    }
};

// ─────────────────────────────────────────
// @desc    Verify Token (used by frontend)
// @route   GET /api/auth/verify
// @access  Private
// ─────────────────────────────────────────
export const verifyToken = (req, res) => {
    res.status(200).json({ success: true, message: "Token is valid", user: req.user });
};