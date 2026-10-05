const mongoose = require('mongoose');
const User = require('../models/User');

// Resolves which user a write (event ingestion, notification dispatch) is attributed
// to, enforcing the ownership boundary server-side:
//   - field omitted        → the caller
//   - non-admin            → may only name themselves; anything else is rejected
//   - admin + null         → no owner (system-wide), only where allowNull is set
//   - admin + an id        → must reference an existing user
// Returns { userId } on success or { error: { message, status, code } }.
const resolveTargetUser = async (req, requested, { field, allowNull = false }) => {
  const self = req.user._id;
  if (requested === undefined) return { userId: self };

  if (req.user.role !== 'admin') {
    if (requested !== null && String(requested) === String(self)) return { userId: self };
    return {
      error: { message: `You can only set ${field} to your own account`, status: 403, code: 'FORBIDDEN_TARGET_USER' },
    };
  }

  if (requested === null) {
    if (allowNull) return { userId: null };
    return { error: { message: `${field} cannot be null`, status: 400, code: 'INVALID_TARGET_USER' } };
  }

  if (typeof requested !== 'string' || !mongoose.isValidObjectId(requested)) {
    return { error: { message: `Invalid format for field: ${field}`, status: 400, code: 'INVALID_ID_FORMAT' } };
  }

  const exists = await User.exists({ _id: requested });
  if (!exists) {
    return { error: { message: `No user found for ${field}`, status: 404, code: 'TARGET_USER_NOT_FOUND' } };
  }
  return { userId: exists._id };
};

module.exports = { resolveTargetUser };
