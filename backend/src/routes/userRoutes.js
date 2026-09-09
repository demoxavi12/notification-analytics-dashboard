const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// All user management routes are restricted to admins
router.use(authenticate, authorize('admin'));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);

module.exports = router;
