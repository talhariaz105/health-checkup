
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const joiError = require('../utils/joiError');
const { createPaymentIntents } = require('../utils/stripe-utils/connect-accounts.util');
const { capturePaymentIntent } = require('../utils/stripe-utils/customers.utils');
const Booking = require('../models/Booking');
const bookingValidationSchema = require('../utils/joi/bookingValidation');
const { createBooking, isBookingExists } = require('../utils/bookingFuncations');

exports.createBookingConsulting = catchAsync(async (req, res, next) => {
    const { paymentMethodid, bookingfee, reason, appointmentDateandTime } = req.body;
    const { error } = bookingValidationSchema.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
    });
    if (error) {
        const errorFields = joiError(error);
        return next(new AppError("Invalid booking data", 400, { errorFields }));

    }
    const isBookingExist = await isBookingExists(appointmentDateandTime);
    if (isBookingExist) {
        return next(new AppError('Booking already exists during your selected date and time',  400, {
            appointmentDateandTime: 'Booking already exists during your selected date and time'
        }));
    }

    const paymentAmount = Math.round(bookingfee * 100);
    const currency = 'usd';
    const paymentMethodId = paymentMethodid;
    const paymentIntent = await createPaymentIntents({ amount: paymentAmount, currency, paymentMethodId });
    try {
        if (paymentIntent.status !== 'requires_capture') {
            return next(new AppError('Card authorization failed.', 401));
        }
        const capturedPayment = await capturePaymentIntent({
            paymentIntentId: paymentIntent.id
        });
        console.log('capturedPayment', capturedPayment);
        if (capturedPayment.status !== 'succeeded') {
            return next(new AppError('Payment capture failed', 400));
        }
        const booking = await createBooking({
            patient: req.user._id,
            appointmentDateandTime: new Date(appointmentDateandTime),
            reason: reason,
            paymentStatus: 'paid',
            bookingfee: bookingfee
        }, req.user);

        res.status(201).json({
            status: 'success',
            data: {
                booking,
                clientSecret: paymentIntent.client_secret,
            },
        });

    } catch (error) {
        return next(new AppError('Payment failed', 400, { error: error.message }));
    }

});

exports.getUserBookings = catchAsync(async (req, res, next) => {

const { userId } = req.params;
const page = parseInt(req.query.page, 10) || 1;
const limit = parseInt(req.query.limit, 10) || 10;
const skip = (page - 1) * limit;

const [bookings, total] = await Promise.all([
    Booking.find({ patient: userId }).skip(skip).limit(limit),
    Booking.countDocuments({ patient: userId })
]);

res.status(200).json({
    status: 'success',
    results: bookings.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: { bookings },
});
});
exports.getClientBookings =  catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const aggregationPipeline = [
        {
            $match: { patient: req.user._id }
        },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                totalCount: [
                    { $count: 'count' }
                ]
            }
        }
    ];

    const result = await Booking.aggregate(aggregationPipeline);
    const bookings = result[0].data;
    const total = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

    res.status(200).json({
        status: 'success',
        results: bookings.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: { bookings },
    });
});


// Get a single booking
exports.getBooking = catchAsync(async (req, res, next) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate('patient');
    if (!booking) return next(new AppError('Booking not found', 404));
    res.status(200).json({
        status: 'success',
        data: { booking },
    });
});


// Get all bookings with aggregation and pagination
exports.getAllBookings = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const aggregationPipeline = [
        {
            $lookup: {
                from: 'users',
                localField: 'patient',
                foreignField: '_id',
                as: 'patient'
            }
        },
        { $unwind: '$patient' },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                totalCount: [
                    { $count: 'count' }
                ]
            }
        }
    ];

    const result = await Booking.aggregate(aggregationPipeline);
    const bookings = result[0].data;
    const total = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

    res.status(200).json({
        status: 'success',
        results: bookings.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: { bookings },
    });
});

// get calendar bookings for a specific month
exports.getCalendarBookings = catchAsync(async (req, res, next) => {
    const filterDate = req.query.filterdate;

    if (!filterDate) {
        return next(new AppError("Missing 'filterdate' in query", 400));
    }

    const dateObj = new Date(filterDate);
    const firstDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const lastDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);

    const bookings = await Booking.find({
        appointmentDateandTime: {
            $gte: firstDayOfMonth,
            $lte: lastDayOfMonth
        }
    }).select('appointmentDateandTime');

    res.status(200).json({
        status: 'success',
        results: bookings.length,
        data: { bookings }
    });
})