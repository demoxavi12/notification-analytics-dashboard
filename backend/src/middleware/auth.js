const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');
const { getJwtSecret } = require('../config/jwt');

// Authenticate user via JWT Bearer token
const authenticate = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(
      res,
      'Access denied. No authentication token provided.',
      401,
      'AUTHENTICATION_REQUIRED'
    );
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    const user = await User.findById(decoded.id).select('+password');
    if (!user) {
      return errorResponse(
        res,
        'User associated with this token no longer exists.',
        401,
        'USER_NOT_FOUND'
      );
    }

    if (user.status === 'suspended') {
      return errorResponse(
        res,
        'Your account has been suspended. Please contact support.',
        403,
        'ACCOUNT_SUSPENDED'
      );
    }

    // Deactivated accounts lose access immediately, including existing sessions.
    if (user.status === 'inactive') {
      return errorResponse(
        res,
        'This account has been deactivated. Please contact an administrator.',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    // Attach user without password to request object
    const userObj = user.toJSON();
    req.user = userObj;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(
        res,
        'Session expired. Please log in again.',
        401,
        'TOKEN_EXPIRED'
      );
    }
    return errorResponse(
      res,
      'Invalid authentication token.',
      401,
      'INVALID_TOKEN'
    );
  }
};

// Authorize based on roles (RBAC)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(
        res,
        'Authentication required.',
        401,
        'AUTHENTICATION_REQUIRED'
      );
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Forbidden: Role '${req.user.role}' is not authorized to access this resource. Requires one of: [${roles.join(', ')}]`,
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
