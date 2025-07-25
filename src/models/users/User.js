const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const validator = require('validator');
const { PhoneNumberUtil } = require('google-libphonenumber');
const { TypeCheck } = require('../../utils/helpers');
const { roles } = require('../../utils/types');

const phoneUtil = PhoneNumberUtil.getInstance();

function toLower(email) {
  if (!email || !TypeCheck(email).isString()) return email;
  return email.toLowerCase();
}

const userSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      unique: true,
      required: true,
      set: toLower,
      validate: [validator.isEmail, 'Please provide a valid email'],
      trim: true
    },
    contact: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          if (!value) return true;
          try {
            const number = phoneUtil.parseAndKeepRawInput(value);
            return phoneUtil.isValidNumber(number);
          } catch (error) {
            return false;
          }
        },
        message: 'Invalid phone number for the specified country'
      }
    },
    password: {
      type: String,
      select: false,
      trim: true
    },
    profilePicture: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: [roles.ADMIN, roles.CLIENT],
      default:roles.CLIENT
    },

    status: {
      type: String,
      trim: true,                                                                                                                                                      
    },

    lastLoginAt: Date,
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    deactivatedAt: Date,
    lastSeen: Date
  },
  {
    discriminatorKey: 'role',
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);


// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  if (!this.password || this.password.length < 6) {
    return next(new Error('Password must be at least 6 characters long.'));
  }

  this.password = await bcrypt.hash(this.password, 12);

  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }

  return next();
});

// Compare passwords
userSchema.methods.comparePasswords = async function (incomingPassword, hashedPassword) {
  return await bcrypt.compare(incomingPassword, hashedPassword);
};

// Check if password changed after token issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

module.exports = model('User', userSchema);
