// controllers/authController.js
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const db = require('../config/database');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('admin', 'manager', 'cashier').required(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]*$/).optional()
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(6).required()
});

// Login user
const login = async (req, res) => {
  try {
    // Validate input
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { username, password } = req.body;

    // Check if user exists
    const userQuery = await db.query(
      'SELECT id, username, email, password_hash, role, full_name, is_active FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = userQuery.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate tokens
    const token = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Remove password from response
    const { password_hash, ...userResponse } = user;

    res.json({
      message: 'Login successful',
      user: userResponse,
      token,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Register new user (admin only)
const register = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can create new users',
        code: 'ADMIN_REQUIRED'
      });
    }

    // Validate input
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { username, email, password, full_name, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists with this username or email',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await db.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, username, email, role, full_name, phone, created_at`,
      [username, email, passwordHash, role, full_name, phone]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: newUser.rows[0]
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get current user info
const getMe = async (req, res) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    // Validate input
    const { error } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    // Get current password hash
    const userQuery = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, userQuery.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Get user info
    const userQuery = await db.query(
      'SELECT id, username, email, role, full_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userQuery.rows.length === 0 || !userQuery.rows[0].is_active) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const user = userQuery.rows[0];

    // Generate new tokens
    const newToken = generateToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken,
      user,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
};

// Get all users (admin only)
const getUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get users with pagination
    const usersQuery = await db.query(
      `SELECT id, username, email, role, full_name, phone, is_active, created_at, updated_at 
       FROM users 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Get total count
    const countQuery = await db.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(countQuery.rows[0].count);

    res.json({
      users: usersQuery.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalUsers / limit),
        total_users: totalUsers,
        limit
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Update user status (admin only)
const updateUserStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { userId } = req.params;
    const { is_active } = req.body;

    // Prevent admin from deactivating themselves
    if (userId === req.user.id && !is_active) {
      return res.status(400).json({
        error: 'Cannot deactivate your own account',
        code: 'SELF_DEACTIVATION_BLOCKED'
      });
    }

    const result = await db.query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, is_active',
      [is_active, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Logout (client-side token removal, server-side logging)
const logout = async (req, res) => {
  try {
    // Log the logout action
    console.log(`User ${req.user.username} logged out at ${new Date().toISOString()}`);
    
    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  login,
  register,
  getMe,
  changePassword,
  refreshToken,
  getUsers,
  updateUserStatus,
  logout
};