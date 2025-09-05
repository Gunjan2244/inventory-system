// routes/auth.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  login,
  register,
  getMe,
  changePassword,
  refreshToken,
  getUsers,
  updateUserStatus,
  logout
} = require('../controllers/authController');

// Public routes
router.post('/login', login);
router.post('/refresh-token', refreshToken);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.post('/logout', authenticateToken, logout);
router.put('/change-password', authenticateToken, changePassword);

// Admin only routes
router.post('/register', authenticateToken, authorizeRoles('admin'), register);
router.get('/users', authenticateToken, authorizeRoles('admin'), getUsers);
router.put('/users/:userId/status', authenticateToken, authorizeRoles('admin'), updateUserStatus);

module.exports = router;