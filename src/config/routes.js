const express = require('express');
const {
  authRoute,
  userRoute,
  bookingRoute,
testRoute
  
} = require('../routes');

const otherRoutes = require('./otherRoutes');


module.exports = (app) => {

  app.use(express.json({ limit: '30mb' }));
  app.use('/api/auth', authRoute);
  app.use('/api/user', userRoute);
  app.use('/api/booking', bookingRoute);
  app.use('/api/test', testRoute);

  otherRoutes(app);
};
