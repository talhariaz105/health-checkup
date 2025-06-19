
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const joiError = require('../utils/joiError');
const { createPaymentIntents } = require('../utils/stripe-utils/connect-accounts.util');
const { capturePaymentIntent } = require('../utils/stripe-utils/customers.utils');
const Test = require('../models/Test');
const {
    fileValidationSchema,
    createTestValidationSchema
} = require('../utils/joi/testValidation');
const { default: mongoose } = require('mongoose');

exports.createTest = catchAsync(async (req, res, next) => {
    const { paymentMethodid, testfee ,testType} = req.body;
    const { error } = createTestValidationSchema.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
    });
    if (error) {
        const errorFields = joiError(error);
        return next(new AppError("Invalid test data", 400, { errorFields }));

    }
    const paymentAmount = Math.round(testfee * 100);
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
        const test = await Test.create({
            patient: req.user._id,
            testType: testType,
            paymentStatus: 'paid',
            testfee: testfee
        });

        res.status(201).json({
            status: 'success',
            data: {
                test,
                clientSecret: paymentIntent.client_secret,
            },
        });

    } catch (error) {
        return next(new AppError('Payment failed', 400, { error: error.message }));
    }

});

exports.getUserTests = catchAsync(async (req, res, next) => {

    const { userId, testType } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [tests, total] = await Promise.all([
        Test.find({ patient: userId, testType }).skip(skip).limit(limit),
        Test.countDocuments({ patient: userId, testType })
    ]);

    res.status(200).json({
        status: 'success',
        results: tests.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: { tests },
    });
});

exports.getClientTests = catchAsync(async (req, res, next) => {
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

    const result = await Test.aggregate(aggregationPipeline);
    const tests = result[0].data;
    const total = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

    res.status(200).json({
        status: 'success',
        results: tests.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: { tests },
    });
});

exports.getTestById = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

    const test = await Test.findById(id).populate("patient", "-password").exec();
    if (!test) return next(new AppError('Test not found', 404));

    return res.status(200).json({ status: 'success', data: test });
});

exports.getAllTests = catchAsync(async (req, res, next) => {
    const testType = req.query.testType;
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
    if (testType) {
        aggregationPipeline[0].$match = { testType: req.query.testType };
    }

    const result = await Test.aggregate(aggregationPipeline);
    const tests = result[0].data;
    const total = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

    res.status(200).json({
        status: 'success',
        results: tests.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: { tests },
    });
});


exports.updateTest = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new AppError('Invalid ID', 400));

    const { error } = fileValidationSchema.validate(req.body);
    if (error) return next(new AppError('Validation error', 400, { error: error.details }));

    const test = await Test.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!test) return next(new AppError('Test not found', 404));

    return res.status(200).json({ status: 'success', data: test });
});