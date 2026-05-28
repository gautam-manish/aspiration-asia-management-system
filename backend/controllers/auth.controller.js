import jwt from "jsonwebtoken";

// ─────────────────────────────────────────
// Hardcoded Admin Credentials
// Change these to whatever you want
// ─────────────────────────────────────────
const ADMIN_USERNAME = "admin";

// ─────────────────────────────────────────
// @desc    Login Admin
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────
export const login = async (req, res) => {
    let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    try {
        const { username, password } = req.body;
        // console.log(ADMIN_PASSWORD);


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
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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