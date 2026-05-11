/**
 * Authentication API — mounted at /api/auth
 */
const express = require("express");

function createAuthRouter({ authenticateUser, generateToken, authenticateToken }) {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required",
        });
      }

      const user = await authenticateUser(username, password);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      const token = generateToken(user);

      req.session.user = user;

      res.json({
        success: true,
        message: "Login successful",
        user: user,
        token: token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
      });
    }
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Error during logout",
        });
      }

      res.json({
        success: true,
        message: "Logout successful",
      });
    });
  });

  router.get("/me", authenticateToken, (req, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  return router;
}

module.exports = { createAuthRouter };
