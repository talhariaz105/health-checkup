const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  createFirstPassword,
  updatePassword
} = require('../controllers/authController');

const router = express.Router();
router.post('/register',  registerUser);
router.post('/login',  loginUser);
router.patch('/updateUserPassword', requireAuth,  updatePassword);
router.post('/forgotPassword',  forgotPassword);
router.patch('/resetPassword',  resetPassword);
router.patch('/createfirstPassword', requireAuth, createFirstPassword);

module.exports = router;                
