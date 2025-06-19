const Joi = require('joi');

const testValidationSchema = Joi.object({
    testType: Joi.string().valid('blood', 'tasso', 'prick'),
    testfee: Joi.number().min(0),
    paymentMethodid: Joi.string(),
    docfile: Joi.string().optional(),
    docfilekey: Joi.string().optional(),
}); 

const createTestValidationSchema = testValidationSchema.fork(['testType', 'testfee', 'paymentMethodid'], (field) => field.required());
const fileValidationSchema = testValidationSchema.fork(['docfile', 'docfilekey'], (field) => field.required());

module.exports = {
    fileValidationSchema,
    createTestValidationSchema
};