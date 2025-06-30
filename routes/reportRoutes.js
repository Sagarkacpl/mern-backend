const express = require('express');
const { adminOnly, protect } = require('../middlewares/authMiddleware');
const { excelTasksReport, excelUsersReport } = require('../controllers/reportControllers');
const router = express.Router();

router.get('/export/tasks', protect, adminOnly, excelTasksReport);
router.get('/export/users', protect, adminOnly, excelUsersReport);


module.exports = router;