const User = require('../models/User');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/apiResponse');
const { asyncHandler } = require('../middleware/errorHandler');
const { queryString, escapeRegex } = require('../utils/queryInput');

// @desc Get all users (Admin only)
// @route GET /api/users
// @access Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  const role = queryString(req.query.role);
  const search = queryString(req.query.search);

  const query = {};

  if (role) {
    query.role = role;
  }

  if (search) {
    // Plain-text match, same approach as event/notification search.
    const pattern = escapeRegex(search);
    query.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { email: { $regex: pattern, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);

  return paginatedResponse(res, users, { total, page, limit }, 'Users retrieved successfully');
});

// @desc Get user by ID (Admin only)
// @route GET /api/users/:id
// @access Private/Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
  }

  return successResponse(res, { user }, 'User details retrieved');
});

// @desc Update user role (Admin only)
// @route PATCH /api/users/:id/role
// @access Private/Admin
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!['admin', 'user'].includes(role)) {
    return errorResponse(res, 'Invalid role. Must be "admin" or "user"', 400, 'INVALID_ROLE');
  }

  // Prevent self-demotion if current admin is editing their own role
  if (req.user._id.toString() === req.params.id && role !== 'admin') {
    return errorResponse(res, 'Admins cannot remove their own admin privileges', 400, 'SELF_DEMOTION_DENIED');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
  }

  return successResponse(res, { user }, `User role updated to ${role}`);
});

// @desc Update user status (Admin only)
// @route PATCH /api/users/:id/status
// @access Private/Admin
const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['active', 'inactive', 'suspended'].includes(status)) {
    return errorResponse(res, 'Invalid status', 400, 'INVALID_STATUS');
  }

  if (req.user._id.toString() === req.params.id && status !== 'active') {
    return errorResponse(res, 'Cannot deactivate or suspend your own account', 400, 'SELF_DEACTIVATION_DENIED');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!user) {
    return errorResponse(res, 'User not found', 404, 'USER_NOT_FOUND');
  }

  return successResponse(res, { user }, `User status updated to ${status}`);
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
};
