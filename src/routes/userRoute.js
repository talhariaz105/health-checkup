const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const { getUser, getUsers, updateUser, deleteUser, updateStatus,getUserProfile,updateUserProfile} = require('../controllers/userController');

const restrictTo = require('../middlewares/restrictTo');
const { roles } = require('../utils/types');
const router = express.Router();
router.use(requireAuth);

router.route('/me')
  .get(restrictTo(roles.ADMIN), getUserProfile)
  .patch(restrictTo(roles.ADMIN), updateUserProfile);
router.route('/:id')
  .get(restrictTo(roles.ADMIN), getUser)
  .patch(restrictTo(roles.ADMIN), updateUser)
  .delete(restrictTo(roles.ADMIN), deleteUser);
router.patch('/me/:id', restrictTo(roles.ADMIN), updateStatus);
router.route('/')
  .get(restrictTo(roles.ADMIN), getUsers)
module.exports = router;

