// auth.js - Authentication middleware
const jwt = require('jsonwebtoken');
const { getUserById } = require('./users');

// Secret key for JWT - in production, use environment variables!
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    // Add user info to request object
    req.user = user;
    next();
  });
}

// Middleware to check if user has specific role
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }
    
    next();
  };
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '24h' } // Token expires in 24 hours
  );
}

module.exports = {
  authenticateToken,
  requireRole,
  generateToken,
  JWT_SECRET
};
