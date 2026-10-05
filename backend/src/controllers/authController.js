const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAuthEvent } = require('../services/eventService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');

const { getJwtSecret, getJwtExpiresIn } = require('../config/jwt');

const { EMAIL_PATTERN, EMAIL_MAX_LENGTH } = User;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MAX_LENGTH = 128; // matches the registration form
const LOGIN_PASSWORD_MAX_LENGTH = 1024; // bound hashing work without locking out older accounts

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const generateToken = (userId) =>
  jwt.sign({ id: userId }, getJwtSecret(), { algorithm: 'HS256', expiresIn: getJwtExpiresIn() });

// @desc Register new user
// @route POST /api/auth/register
// @access Public
const register = asyncHandler(async (req, res) => {
  // `role` (and any other field) from the request body is intentionally ignored:
  // public registration can never choose a role. Admins are provisioned only via
  // trusted paths (seed script, or an existing admin using PATCH /api/users/:id/role).
  const { name, password } = req.body;

  if (!isNonEmptyString(name) || !isNonEmptyString(req.body.email) || !isNonEmptyString(password)) {
    return errorResponse(res, 'Name, email, and password are required', 400, 'MISSING_FIELDS');
  }

  // Validate before any query or hashing work: strings only (no operator objects),
  // bounded lengths, and a linear-time email check.
  const email = req.body.email.trim().toLowerCase();
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return errorResponse(res, 'Please provide a valid email address', 400, 'VALIDATION_ERROR');
  }
  if (name.trim().length > NAME_MAX_LENGTH) {
    return errorResponse(res, `Name cannot exceed ${NAME_MAX_LENGTH} characters`, 400, 'VALIDATION_ERROR');
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return errorResponse(res, `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters`, 400, 'VALIDATION_ERROR');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return errorResponse(res, 'An account with this email address already exists', 400, 'USER_EXISTS');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'user',
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

  // Strings only: an object such as {"$ne": null} must never reach the query.
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return errorResponse(res, 'Email and password are required', 400, 'MISSING_CREDENTIALS');
  }
  if (email.length > EMAIL_MAX_LENGTH || password.length > LOGIN_PASSWORD_MAX_LENGTH) {
    return errorResponse(res, 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

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

  // "inactive" means deactivated (see userController: changing a status away from
  // "active" is a deactivation), so it blocks sign-in like a suspension does.
  if (user.status === 'inactive') {
    return errorResponse(res, 'This account has been deactivated. Please contact an administrator.', 403, 'ACCOUNT_INACTIVE');
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
