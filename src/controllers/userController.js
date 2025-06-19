const mongoose = require('mongoose');
const User = require('../models/users/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const joiError = require('../utils/joiError');
const { userUpdateSchema } = require('../utils/joi/userValidation');
const { roles } = require('../utils/types');
const Email = require('../utils/email');

const sendEmail = async (subject, email, text, data) => {
  await new Email(email, subject).sendTextEmail(subject, text, data);
};


// Get single user (all roles)
const getUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findById(id).select('-password');
  if (!user) return next(new AppError('User not found', 404));

  return res.status(200).json({ status: 'success', data: user });
});

// List users with filters (role, search, pagination)
const getUsers = catchAsync(async (req, res, next) => {
  const { role, search = '', page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;
  const match = {};

  if (role && Object.values(roles).includes(role)) match.role = role;
  if (status) match.status = status;
  if (search) match.$or = [
    { firstName: { $regex: search, $options: 'i' } },
    { lastName: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];

  const [total, users] = await Promise.all([
    User.countDocuments(match),
    User.find(match)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 })
      .select('-password')
  ]);

  res.status(200).json({
    status: 'success',
    total,
    results: users.length,
    data: users
  });
});

// Update user (all roles)
const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { error } = userUpdateSchema.validate(req.body);
  if (error) return next(new AppError(joiError(error), 400));

  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).select('-password');
  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({ status: 'success', data: user });
});

// Delete (soft)
const deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndUpdate(id, { status: 'Delete' }, { new: true });
  if (!user) return next(new AppError('User not found', 404));

  res.status(204).json({ status: 'success', data: null });
});

// Update status (active/inactive/suspend)
const updateStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return next(new AppError('Status is required', 400));

  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!user) return next(new AppError('User not found', 404));

  if (status === 'Active') {
    try {
      await sendEmail('Account Activated', user.email, `Hi ${user.firstName}, your account is active now.`);
    } catch (err) { console.error('Email error:', err); }
  }

  res.status(200).json({ status: 'success', data: user });
});



module.exports = { getUser, getUsers, updateUser, deleteUser, updateStatus };