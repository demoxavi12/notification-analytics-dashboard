const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Same pragmatic rule as the frontend: one "@", no whitespace, a dotted domain and a
// 2+ letter TLD. Domain segments exclude "." so each dot is a single, unambiguous
// split point: matching stays linear instead of backtracking exponentially.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
const EMAIL_MAX_LENGTH = 254;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [EMAIL_MAX_LENGTH, `Email cannot exceed ${EMAIL_MAX_LENGTH} characters`],
      // Linear-time pattern (the previous nested-quantifier regex backtracked
      // exponentially: ~30 characters blocked the event loop for ~30 seconds).
      match: [EMAIL_PATTERN, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.EMAIL_PATTERN = EMAIL_PATTERN;
module.exports.EMAIL_MAX_LENGTH = EMAIL_MAX_LENGTH;
