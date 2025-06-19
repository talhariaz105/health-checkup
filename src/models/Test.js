const mongoose = require('mongoose');

const TestSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    testType: {
        type: String,
        enum: ['blood', 'tasso', 'prick'],
        required: true,
    },
    docfile: {
        type: String,
    },
    docfilekey: {
        type: String,
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending',
    },
    testfee: {
        type: Number,
        required: true,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Test', TestSchema);