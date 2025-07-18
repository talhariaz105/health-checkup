const Joi = require('joi');
const { roles } = require('../types');
const JoiPhoneNumber = require('joi-phone-number');
const JoiContact = Joi.extend(JoiPhoneNumber);
const base = {
  name: Joi.string().trim().max(50),
  email: Joi.string().email().trim(),
  contact: JoiContact.string()
    .phoneNumber({
      format: 'e164',      // enforces +<countrycode><number> format
      strict: true         // ensures number is valid for its region
    })
    .messages({
      'string.contact': 'Please enter a valid international phone number.'
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
  ["name", 'email', 'contact', 'city', 'address', 'postalCode', 'password'], s => s.required()
);

exports.userUpdateSchema = Joi.object(base);
