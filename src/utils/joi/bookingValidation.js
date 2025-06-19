const Joi = require('joi');
const mongoose = require('mongoose');

const bookingValidationSchema = Joi.object({
    appointmentDateandTime: Joi.date().greater('now').required(),
    reason: Joi.string().optional(),
    bookingfee: Joi.number().min(0).required(),
    paymentMethodid: Joi.string().required(),
}); 

module.exports = bookingValidationSchema;