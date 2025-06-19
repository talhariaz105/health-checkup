const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const User = require('../models/users/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { removeFields } = require('../utils/helpers');
const Email = require('../utils/email');
const { userCreateSchema } = require('../utils/joi/userValidation');
const {
  emailVerifySchema,
  LoginSchema
} = require('../utils/joi/emailValidation');
const joiError = require('../utils/joiError');
const { createPaymentIntents } = require('../utils/stripe-utils/connect-accounts.util');
const { capturePaymentIntent, cancelPaymentIntent } = require('../utils/stripe-utils/customers.utils');
const bookingValidationSchema = require('../utils/joi/bookingValidation');
const { createBooking, isBookingExists } = require('../utils/bookingFuncations');

const signToken = (user, expires = process.env.JWT_EXPIRES_IN) => jwt.sign({ user }, process.env.JWT_SECRET, {
  expiresIn: expires
});


const createSendToken = (user, statusCode, res) => {
  const userWithRemovedFields = removeFields(user.toJSON(), [
    'password',
    'passwordChangedAt',
    'passwordResetToken',
    'passwordResetExpires',
    'otp',
    'otpExpiration',
    'otpVerifiedAt',
    'lastLoginAt',
    'createdAt',
    'updatedAt'
  ]);
  const token = signToken(userWithRemovedFields);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: userWithRemovedFields
  });
};

const sendEmail = async (template, subject, email, data) => {
  await new Email(email, subject).send(template, subject, data);
};
const registerUser = catchAsync(async (req, res, next) => {
  const { paymentMethodid, bookingfee, reason, appointmentDateandTime } = req.body;
  const { error } = userCreateSchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: true
  });
  const { error: bookingError } = bookingValidationSchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: true
  });

  if (error || bookingError) {
    const allDetails = [
      ...(error?.details || []),
      ...(bookingError?.details || [])
    ];
    const errorFields = joiError({ details: allDetails });
    return next(new AppError('Validation failed', 400, { errorFields }));
  }
  const isBookingExist = await isBookingExists(appointmentDateandTime);
  if (isBookingExist) {
    return next(new AppError('Booking already exists during your selected date and time', 400, {
      appointmentDateandTime: 'Booking already exists during your selected date and time'
    }));
  }
  const { email } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('Email already exists!', 400, {
      email: 'Email already exists!'
    }));
  }
  const paymentAmount = Math.round(bookingfee * 100);
  const currency = 'usd';
  const paymentMethodId = paymentMethodid;
  const paymentIntent = await createPaymentIntents({ amount: paymentAmount, currency, paymentMethodId });
  console.log('paymentIntent', paymentIntent);
  try {
    if (paymentIntent.status !== 'requires_capture') {
      return next(new AppError('Card authorization failed.', 401));
    }
    const newUser = new User(req.body);
    const capturedPayment = await capturePaymentIntent({
      paymentIntentId: paymentIntent.id
    });
    console.log('capturedPayment', capturedPayment);
    if (capturedPayment.status !== 'succeeded') {
      return next(new AppError('Payment capture failed', 400));
    }
    await createBooking({
      patient: newUser._id,
      appointmentDateandTime: appointmentDateandTime,
      reason: reason,
      paymentStatus: 'paid',
      bookingfee: bookingfee
    }, newUser);
    await newUser.save({ validateBeforeSave: false });
    await createSendToken(newUser, 201, res);

  } catch (error) {

    if (paymentIntent && paymentIntent.id) {
      try {
        await cancelPaymentIntent({ paymentIntentId: paymentIntent.id });
      } catch (cancelError) {
        console.error('Failed to cancel PaymentIntent:', cancelError.message);
      }
    }
    return next(new AppError(error?.message, 500));
  }
});

const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const { error } = LoginSchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});

    return next(new AppError('Validation failed', 400, { errorFields }));
  }


  const user = await User.findOne({ email }).select('+password');


  if (!user) {
    const fieldErrors = {
      password: 'Invalid Credentials'
    };
    return next(new AppError('Invalid credentials', 401, fieldErrors));
  }

  if (user?.status === "Pending") {
    return next(new AppError('This account is under review by Admin. Please contact with Admin', 404));
  } if (user?.status === "Rejected") {
    return next(new AppError('This account is rejected by Admin. Please contact with Admin', 404));
  }
  if (user && user?.status === "Delete") {
    return next(new AppError('This account deleted by Admin. Please contact with Admin', 404));
  }


  if (user && (user?.status === "Suspend" || user?.status === "Inactive")) {
    return next(new AppError('This account Suspend by Admin. Please contact with Admin', 401));
  }

  if (!user.password) {
    const fieldErrors = {
      password: 'This account uses social login. Please login using Google/Facebook'
    };
    return next(
      new AppError(
        'This account uses social login. Please login using Google/Facebook',
        401,
        fieldErrors
      )
    );
  }

  // validate the password
  if (user) {
    const isPasswordCorrect = await user.comparePasswords(password, user.password);
    if (!isPasswordCorrect) {
      const fieldErrors = {
        password: 'Invalid Credentials'
      };
      return next(new AppError('Invalid credentials', 401, fieldErrors));
    }
  }


  user.lastLoginAt = Date.now();
  const userData = removeFields(user.toObject(), [
    'password',
    'passwordChangedAt',
    'OTP',
    'otpExpiration',
    'otpVerifiedAt',
    'passwordResetToken',
    'passwordResetExpires',
    'lastLoginAt',
    'createdAt',
    'updatedAt'
  ]);

  // Save the original Mongoose document (if needed)
  await user.save({ validateBeforeSave: false });
  const token = signToken(userData);

  res.locals.dataId = user._id;
  res.locals.actor = user;
  return res.status(200).json({
    status: 'success',
    token,
    data: userData
  });
});

const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Validate email
  const { error } = emailVerifySchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorFields = error.details.reduce((acc, err) => {
      acc[err.context.key] = err.message.replace(/['"]/g, '');
      return acc;
    }, {});
    return next(new AppError('Validation failed', 400, { errorFields }));
  }
  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('User not found', 404, { user: 'user not found' }));
  }

  if (user && user?.status === "Delete") {
    return next(new AppError('This account deleted by Admin. Please contact with Admin', 404));
  }


  if (user && user?.status === "Suspend" || user?.status === "Inactive") {
    return next(new AppError('This account Suspend by Admin. Please contact with Admin', 401));
  }

  // const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
  //   expiresIn: "6m",
  // });

  // console.log("\nresetToken:", resetToken);

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Optionally store in Redis if needed
  // await redisClient.setEx(`resetPassword:${user._id}`, 10 * 60, resetToken);

  // Generate reset URL with token
  const origin = req.get('origin') || process.env.FRONTEND_URL;

  // Ensure correct reset URL based on request origin
  const resetURL = `${origin}/reset-password?token=${resetToken}`;


  try {
    await sendEmail('forgotEmail', 'Reset Your Password', email, {
      firstName: user.firstName,
      resetURL
    });

    // // save the passwordResetToken and passwordResetExpires in DB
    // user.passwordResetToken = resetToken;
    // // user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    // await user.save({ validateBeforeSave: false });
    res.locals.dataId = user._id;
    res.locals.actor = user;

    return res.status(200).json({
      status: 'success',
      message: 'Password reset link sent successfully!'
    });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('There was an error sending the email. Try again later!'), 500);
  }
});

const resetPassword = catchAsync(async (req, res, next) => {
  const { password, token } = req.body;
  // let decoded;

  if (!password || !token) {
    const fieldErrors = {
      password: password ? undefined : 'Password is required.',
      token: token ? undefined : 'Token is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }



  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  }).select('+password');

  if (!user) {
    return next(new AppError('Invalid request.', 404, { user: 'user not found' }));
  }

  if (user && user?.status === "Delete") {
    return next(new AppError('This account deleted by Admin. Please contact with Admin', 404));
  }


  if (user && user?.status === "Suspend" || user?.status === "Inactive") {
    return next(new AppError('This account Suspend by Admin. Please contact with Admin', 401));
  }
  if (await user.comparePasswords(password, user.password)) {
    const fieldErrors = {
      password: 'Your new password must be different from the current one.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  user.password = password;
  user.passwordChangedAt = Date.now();
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save({ validateBeforeSave: false });
  res.locals.dataId = user._id;
  res.locals.actor = user;
  return createSendToken(user, 200, res);
});

const updatePassword = catchAsync(async (req, res, next) => {
  const { password, oldPassword } = req.body;
  const { user } = req;
  if (!password || !oldPassword) {
    const fieldErrors = {
      password: password ? undefined : 'Password is required.',
      oldPassword: oldPassword ? undefined : 'Old Password is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  if (!user) {
    return next(new AppError('user not found', 404, { user: 'user not found' }));
  }

  // check if the old password is equal to stored password(correct old password)
  if (!(await user.comparePasswords(oldPassword, user.password))) {
    const fieldErrors = {
      password: 'Provided old password is incorrect'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }
  // new password must not be equal to old password
  if (await user.comparePasswords(password, user.password)) {
    const fieldErrors = {
      password: 'Your new password must be different from the current one.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  user.password = password;
  user.passwordChangedAt = Date.now();
  user.passwordResetToken = undefined;

  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: { email: user.email },
    message: 'Password updated Successfully'
  });
});

const createFirstPassword = catchAsync(async (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    const fieldErrors = {
      password: password ? undefined : 'Password is required.'
    };
    return next(new AppError('Validation failed', 400, fieldErrors));
  }

  const user = await User.findOne({
    _id: req?.user?._id
  }).select('+password');

  if (!user) {
    return next(new AppError('user not found', 404, { user: 'user not found' }));
  }

  user.password = password;
  user.passwordChangedAt = Date.now();
  if (!user.providers.includes('local')) {
    user.providers.push('local');
  }
  res.locals.dataId = user._id;
  res.locals.actor = req.user;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 'success',
    data: { email: user.email },
    message: 'Password created Successfully'
  });
});


module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  createFirstPassword,
  sendEmail,
  updatePassword,
};
