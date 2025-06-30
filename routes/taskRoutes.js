const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { protect, adminOnly } = require('../middlewares/authMiddleware.js');
const User = require('../models/User');
const { getDashboardData, getUserDashboardData, getTasks, getTaskById, createTask, updateTask, deleteTask, updateTaskChecklist, updateTaskStatus } = require('../controllers/taskControllers.js');

const router    = require('express').Router();

router.get('/dashboard-data', protect, getDashboardData);
router.get('/user-dashboard-data', protect, getUserDashboardData);
router.get('/', protect, getTasks);
router.get('/:id', protect, getTaskById);
router.post('/', protect, adminOnly, createTask);
router.put('/:id', protect, updateTask);
router.delete('/:id', protect, adminOnly, deleteTask);
router.put('/:id/status', protect, updateTaskStatus);
router.put('/:id/todo', protect, updateTaskChecklist);

module.exports = router;
