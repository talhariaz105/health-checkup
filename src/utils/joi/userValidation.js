const Joi = require('joi');
const { roles } = require('../types');
const base = {
  name: Joi.string().trim().max(50),
  email: Joi.string().email().trim(),
  contact: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).trim().max(15).message({
    'string.pattern.base': 'Contact number must be a valid phone number format (e.g., +1234567890)',
    'string.max': 'Contact number must not exceed 15 characters'
  }),
  city: Joi.string().trim().max(100),
  profilePicture: Joi.string().uri().trim(),
  address: Joi.string().trim().max(200),
  postalCode: Joi.string().trim().max(20),
  password: Joi.string().min(6),
  role: Joi.string().valid(...Object.values(roles)),
  status: Joi.string().valid('Active', 'Inactive', 'Suspend', 'Delete'),


};
exports.userCreateSchema = Joi.object(base).fork(
  ["name", 'email', 'contact', 'city',  'address', 'postalCode', 'password'], s => s.required()
);

exports.userUpdateSchema = Joi.object(base);
