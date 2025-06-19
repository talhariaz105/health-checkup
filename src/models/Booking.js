const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    appointmentDateandTime: {
        type: Date,
        required: true,
    },
    reason: {
        type: String,
        required: false,
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending',
    },
    bookingfee: {
        type: Number,
        required: true,
    },
    meetingLink: {
        type: String,
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Booking', BookingSchema);