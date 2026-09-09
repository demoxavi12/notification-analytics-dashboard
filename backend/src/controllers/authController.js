const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAuthEvent } = require('../services/eventService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_notification_saas_2025';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id: userId }, secret, { expiresIn });
};

// @desc Register new user
// @route POST /api/auth/register
// @access Public
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return errorResponse(res, 'Name, email, and password are required', 400, 'MISSING_FIELDS');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return errorResponse(res, 'An account with this email address already exists', 400, 'USER_EXISTS');
  }

  // Create user - prevent arbitrary admin escalation in public registration unless explicitly testing
  const assignedRole = role === 'admin' && process.env.NODE_ENV === 'development' ? 'admin' : 'user';

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: assignedRole,
  });

  const token = generateToken(user._id);

  // Emit signup event
  await logAuthEvent('user.signup', user._id, {
    email: user.email,
    role: user.role,
    ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
  }, 'success');

  return successResponse(
    res,
    {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    },
    'Account registered successfully',
    201
  );
});

// @desc Login user
// @route POST /api/auth/login
// @access Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 'Email and password are required', 400, 'MISSING_CREDENTIALS');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    // Log failed attempt
    await logAuthEvent('user.login.failed', user._id, {
      email: user.email,
      reason: 'Incorrect password',
    }, 'warning');

    return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status === 'suspended') {
    return errorResponse(res, 'Account is suspended', 403, 'ACCOUNT_SUSPENDED');
  }

  const token = generateToken(user._id);

  // Log successful login
  await logAuthEvent('user.login', user._id, {
    email: user.email,
    ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    userAgent: req.headers['user-agent'],
  }, 'success');

  return successResponse(
    res,
    {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    },
    'Login successful'
  );
});

// @desc Get current authenticated user profile
// @route GET /api/auth/me
// @access Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
  }

  return successResponse(res, { user }, 'Profile retrieved');
});

// @desc Logout user (client-side token removal)
// @route POST /api/auth/logout
// @access Private
const logout = asyncHandler(async (req, res) => {
  return successResponse(res, null, 'Logged out successfully');
});

module.exports = {
  register,
  login,
  getMe,
  logout,
};
