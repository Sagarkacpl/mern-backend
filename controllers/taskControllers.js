const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');

// Get tasks with filtering and role-based access
const getTasks = async (req, res) => {
    try {
        const { status, priority } = req.query; // ✅ Added priority
        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (priority) {
            filter.priority = priority; // ✅ Added priority filter
        }

        if (req.user.role !== 'admin') {
            filter.assignedTo = req.user._id;
        }

        let tasks = await Task.find(filter).populate('assignedTo', 'name email profileImageUrl');

        tasks = await Promise.all(tasks.map(async (task) => {
            const completedCount = task.todoChecklist.filter(item => item.completed).length;
            return {
                ...task._doc,
                completedTodoCount: completedCount,
            };
        }));

        const baseFilter = req.user.role === 'admin' ? {} : { assignedTo: req.user._id };

        const [allTasks, pendingTasks, inProgressTasks, completedTasks] = await Promise.all([
            Task.countDocuments(baseFilter),
            Task.countDocuments({ ...baseFilter, status: 'Pending' }),
            Task.countDocuments({ ...baseFilter, status: 'In Progress' }),
            Task.countDocuments({ ...baseFilter, status: 'Completed' }),
        ]);

        res.status(200).json({
            message: 'Tasks fetched successfully',
            tasks,
            taskCounts: {
                all: allTasks,
                pending: pendingTasks,
                inProgress: inProgressTasks,
                completed: completedTasks
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Get task by ID
const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id).populate('assignedTo', 'name email profileImageUrl');
        if (!task) return res.status(404).json({ message: 'Task not found' });
        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create task
const createTask = async (req, res) => {
    try {
        const { title, description, priority, dueDate, assignedTo, attachments, todoChecklist } = req.body;

        if (!Array.isArray(assignedTo)) {
            return res.status(400).json({ message: 'assignedTo must be an array of user IDs' });
        }

        if (!title || !description || !assignedTo.length) {
            return res.status(400).json({ message: 'Title, description, and assignedTo are required' });
        }

        if (priority && !['High', 'Medium', 'Low'].includes(priority)) { // ✅ Priority validation
            return res.status(400).json({ message: 'Invalid priority value' });
        }

        const task = await Task.create({
            title,
            description,
            priority,
            dueDate,
            assignedTo,
            checklist: req.user._id,
            todoChecklist,
            attachments,
        });

        res.status(201).json({ message: 'Task created successfully', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update task
const updateTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        if (req.body.priority && !['High', 'Medium', 'Low'].includes(req.body.priority)) { // ✅ Priority validation
            return res.status(400).json({ message: 'Invalid priority value' });
        }

        task.title = req.body.title || task.title;
        task.description = req.body.description || task.description;
        task.priority = req.body.priority || task.priority;
        task.dueDate = req.body.dueDate || task.dueDate;
        task.attachments = req.body.attachments || task.attachments;
        task.todoChecklist = req.body.todoChecklist || task.todoChecklist;

        if (req.body.assignedTo) {
            if (!Array.isArray(req.body.assignedTo)) {
                return res.status(400).json({ message: 'assignedTo must be an array of user IDs' });
            }
            task.assignedTo = req.body.assignedTo;
        }

        const updateTask = await task.save();
        res.status(200).json({ message: 'Task updated successfully', updateTask });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete task
const deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        await task.deleteOne();
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update task status
const updateTaskStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        const isAssigned = task.assignedTo.some(userId => userId.toString() === req.user._id.toString());
        if (!isAssigned && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to update this task' });
        } 
        task.status = status || task.status;
        if (status === 'Completed') {
            task.todoChecklist.forEach(item => {item.completed = true;});
            task.progress = 100;
        }
        await task.save();
        res.status(200).json({ message: 'Task status updated', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update task checklist
const updateTaskChecklist = async (req, res) => {
    try {
        const { todoChecklist } = req.body;
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        if(!task.assignedTo.includes(req.user._id) && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to update this task' });
        }

        task.todoChecklist = todoChecklist;
        const completedCount = todoChecklist.filter(item => item.completed).length;
        const totalCount = todoChecklist.length;
        task.progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        if(task.progress === 100) {
            task.status = 'Completed';
        } else if(task.progress > 0) {
            task.status = 'In Progress';
        } else {
            task.status = 'Pending';
        }
        await task.save();
        const updatedTask = await Task.findById(req.params.id).populate('assignedTo', 'name email profileImageUrl');
        res.status(200).json({ message: 'Task checklist updated', task: updatedTask });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Admin Dashboard data
const getDashboardData = async (req, res) => {
    try {
        const users = await User.countDocuments();
        const tasks = await Task.countDocuments();
        const pendingTasks = await Task.countDocuments({ status: 'Pending' });
        const completedTasks = await Task.countDocuments({ status: 'Completed' });
        const overdueTasks = await Task.countDocuments({ dueDate: { $lt: new Date() }, status: { $ne: 'Completed' } });

        const taskStatuses = ["Pending", "In Progress", "Completed"];
        const taskDistributionRaw = await Task.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const taskDistribution = taskStatuses.reduce((acc, status) => {
            const formateKey = status.replace(/\s+/g, ' ').trim();
            acc[formateKey] = taskDistributionRaw.find(item => item._id === status)?.count || 0;
            return acc;
        }, {});
        taskDistribution['All'] = tasks;

        const taskPriorities = ["Low", "Medium", "High"];
        const taskPriorityDistributionRaw = await Task.aggregate([
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]);
        const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
            acc[priority] = taskPriorityDistributionRaw.find(item => item._id === priority)?.count || 0;
            return acc;
        }, {});

        const recentTasks = await Task.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select("title status dueDate createdAt priority"); // ✅ Added priority

        res.status(200).json({
            statistics: {
                users,
                tasks,
                pendingTasks,
                completedTasks,
                overdueTasks,
            },
            charts: {
                taskDistribution,
                taskPriorityLevels
            },
            recentTasks
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// User-specific dashboard data
const getUserDashboardData = async (req, res) => {
    try {
        const userId = req.user._id;

        const totalTasks = await Task.countDocuments({ assignedTo: userId });
        const completedTasks = await Task.countDocuments({ assignedTo: userId, status: 'Completed' });
        const pendingTasks = await Task.countDocuments({ assignedTo: userId, status: 'Pending' });
        const overdueTasks = await Task.countDocuments({
            assignedTo: userId,
            dueDate: { $lt: new Date() },
            status: { $ne: 'Completed' }
        });

        const taskStatuses = ["Pending", "In Progress", "Completed"];
        const taskDistributionRaw = await Task.aggregate([
            { $match: { assignedTo: userId } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const taskDistribution = taskStatuses.reduce((acc, status) => {
            const formateKey = status.replace(/\s+/g, ' ').trim();
            acc[formateKey] = taskDistributionRaw.find(item => item._id === status)?.count || 0;
            return acc;
        }, {});
        taskDistribution['All'] = totalTasks;

        const taskPriorities = ["Low", "Medium", "High"];
        const taskPriorityDistributionRaw = await Task.aggregate([
            { $match: { assignedTo: userId } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]);
        const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
            acc[priority] = taskPriorityDistributionRaw.find(item => item._id === priority)?.count || 0;
            return acc;
        }, {});

        const recentTasks = await Task.find({ assignedTo: userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select("title status dueDate createdAt priority"); // ✅ Added priority

        res.status(200).json({
            statistics: {
                totalTasks,
                completedTasks,
                pendingTasks,
                overdueTasks
            },
            charts: {
                taskDistribution,
                taskPriorityLevels
            },
            recentTasks
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    updateTaskChecklist,
    getDashboardData,
    getUserDashboardData
};
