const Joi = require('joi');


const bookingValidationSchema = Joi.object({
    appointmentDateandTime: Joi.required(),
    reason: Joi.string().optional(),
    bookingfee: Joi.number().min(0).required(),
    paymentMethodid: Joi.string().required(),
}); 

module.exports = bookingValidationSchema;