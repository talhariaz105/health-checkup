const mongoose = require('mongoose');
const User = require('../models/users/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const joiError = require('../utils/joiError');
const { userUpdateSchema } = require('../utils/joi/userValidation');
const { roles } = require('../utils/types');
const Email = require('../utils/email');
const Booking = require('../models/Booking');
const Test = require('../models/Test');

const sendEmail = async (subject, email, text, data) => {
  await new Email(email, subject).sendTextEmail(subject, text, data);
};


// Get single user (all roles)
const getUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

  const userAgg = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: 'tests',
        localField: '_id',
        foreignField: 'patient',
        as: 'tests'
      }
    },
    {
      $lookup: {
        from: 'bookings',
        localField: '_id',
        foreignField: 'patient',
        as: 'appointments'
      }
    },
    {
      $project: { password: 0 }
    }
  ]);

  if (!userAgg || userAgg.length === 0) return next(new AppError('User not found', 404));

  return res.status(200).json({ status: 'success', data: userAgg[0] });
});

// List users with filters (role, search, pagination)
const getUsers = catchAsync(async (req, res, next) => {
  const { status, search = '', page = 1, limit = 10, role = "client" } = req.query;
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
const updateUserProfile = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { error } = userUpdateSchema.validate(req.body);
  if (error) {
    const errorFields = error.details.map(detail => detail.message).join(', ');
    return next(new AppError("Invalid user data: ", 400, { errorFields }));
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) return next(new AppError('Invalid ID', 400));

  const user = await User.findByIdAndUpdate(userId, req.body, { new: true });
  console.log("Updated user:", req.body);
  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({ status: 'success', data: user });
});

const updateUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { error } = userUpdateSchema.validate(req.body);
  if (error) {
    const errorFields = joiError(error);
    return next(new AppError("Invalid user data: ", 400, { errorFields }));
  }

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


const getUserProfile = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  if (!mongoose.Types.ObjectId.isValid(userId)) return next(new AppError('Invalid User ID', 400));

  const userAgg = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'tests',
        localField: '_id',
        foreignField: 'patient',
        as: 'tests'
      }
    },
    {
      $lookup: {
        from: 'bookings',
        localField: '_id',
        foreignField: 'patient',
        as: 'appointments'
      }
    },
    {
      $project: { password: 0 }
    }
  ]);

  if (!userAgg || userAgg.length === 0) return next(new AppError('User not found', 404));

  return res.status(200).json({ status: 'success', data: userAgg[0] });
});


// Dashboard statistics 

const getDashboardStats = catchAsync(async (req, res, next) => {
  const totalUsers = await User.countDocuments({ role: 'client' });
  const totalTests = await Test.countDocuments();

  // Consulting stats
  const totalConsulting = await Booking.aggregate([
    {
      $addFields: {
        status: {
          $cond: [
            { $lt: ["$appointmentDateandTime", new Date()] },
            "completed",
            "pending"
          ]
        }
      }
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        status: "$_id",
        count: 1
      }
    }
  ]);
  console.log("Consulting stats aggregation:", totalConsulting);

  // Weekly meetings (appointments) tracker for current week
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const weeklyMeetings = await Booking.aggregate([
    {
      $match: {
        appointmentDateandTime: {
          $gte: startOfWeek,
          $lte: endOfWeek
        }
      }
    },
    {
      $group: {
        _id: { $dayOfWeek: "$appointmentDateandTime" }, // 1=Sunday, 7=Saturday
        count: { $sum: 1 }
      }
    }
  ]);

  // Map days to Mon-Sat (for chart)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData = [0, 0, 0, 0, 0, 0, 0];
  weeklyMeetings.forEach(item => {
    weeklyData[item._id - 1] = item.count;
  });

  // Meeting completion tracker (attended vs pending this week)
  const totalConsultingdata = totalConsulting.reduce((acc, curr) => {
    acc[curr.status] = curr.count;
    return acc;
  }, { pending: 0, completed: 0 })

  const totalMeetings = totalConsultingdata.completed + totalConsultingdata.pending;
  console.log("Total meetings:", totalMeetings);
  const completionPercent = totalMeetings ? Math.round((totalConsultingdata.completed * 100 / totalMeetings)) : 0;

  res.status(200).json({
    status: 'success',
    data: {
      totalUsers,
      totalTests,
      totalConsulting: totalConsultingdata,
      weeklyMeetings: {
        days: days.slice(1).concat(days[0]), // ['Mon', ..., 'Sat', 'Sun']
        counts: weeklyData.slice(1).concat(weeklyData[0]) // align to Mon-Sat-Sun
      },
      meetingCompletion: {
        attended: totalConsultingdata.completed,
        pending: totalConsultingdata.pending,
        percent: completionPercent
      }
    }
  });
});





module.exports = { getUser, getUsers, updateUserProfile, updateUser, deleteUser, updateStatus, getUserProfile, getDashboardStats };