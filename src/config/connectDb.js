const mongoose = require('mongoose');
require('dotenv').config();
require('colors');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 60000,
    });

    console.log('Connected to MongoDB'.green.bold);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Mongo URI: ${process.env.MONGO_URI}`.yellow);
    }

  } catch (error) {
    console.error('Error connecting to MongoDB:'.red.bold, error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
