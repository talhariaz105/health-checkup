const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const restrictTo = require('../middlewares/restrictTo');
const {
    createTest,
    getUserTests,
    getTestById,
    getAllTests,
    updateTest,
    getClientTests
} = require('../controllers/testController');

const router = express.Router();
router.get('/client', requireAuth, getClientTests);
router.post('/', requireAuth, createTest);
router.get('/user/:userId', requireAuth, getUserTests);
router.get('/:id', requireAuth, getTestById);
router.get('/', requireAuth, restrictTo(['admin']), getAllTests);
router.patch('/:id', requireAuth, updateTest);

module.exports = router;