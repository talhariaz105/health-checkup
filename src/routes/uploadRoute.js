const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const {
  initiateUpload,
  generatePresignedUrl,
  completeUpload
} = require('../controllers/uploadController');


const router = express.Router();

router.post('/initiate-upload', requireAuth, initiateUpload);
router.post('/generate-presigned-url', requireAuth, generatePresignedUrl);
router.post('/complete-upload', requireAuth, completeUpload);

module.exports = router;
