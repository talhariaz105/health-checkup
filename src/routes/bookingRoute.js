const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const restrictTo = require('../middlewares/restrictTo');
const {
  createBookingConsulting,
  getUserBookings,
  getBooking,
  getAllBookings,
  getClientBookings,
  getCalendarBookings
} = require('../controllers/bookingController');

const router = express.Router();

router.post('/', requireAuth, createBookingConsulting);
router.get('/calendar', getCalendarBookings); // For getting calendar bookings
router.get('/user/:userId', requireAuth, getUserBookings);
router.get('/client', requireAuth, getClientBookings);
router.get('/:bookingId', requireAuth, getBooking);
router.get('/', requireAuth, restrictTo(['admin']), getAllBookings);

module.exports = router;