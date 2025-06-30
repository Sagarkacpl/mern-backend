const excelJs = require('exceljs');
const User = require('../models/User');
const Task = require('../models/Task');

const excelTasksReport = async (req, res) => {
    try {
        const tasks = await Task.find().populate('assignedTo', 'name email').populate('createdBy', 'name');
        const workbook = new excelJs.Workbook();
        const worksheet = workbook.addWorksheet('Tasks Report');

        worksheet.columns = [
            { header: 'Task ID', key: '_id', width: 30 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Description', key: 'description', width: 50 },
            { header: 'Priority', key: 'priority', width: 15 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Due Date', key: 'dueDate', width: 20 },
            { header: 'Assigned To', key: 'assignedTo', width: 30 },
        ];

        tasks.forEach(task => {
            const assignedTo = Array.isArray(task.assignedTo)
                ? task.assignedTo
                    .map(user => `${user.name} (${user.email})`)
                    .join(', ')
                : 'Unassigned';

            worksheet.addRow({
                _id: task._id.toString(),
                title: task.title,
                description: task.description,
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : '',
                assignedTo: assignedTo
            });
        });


        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=tasks_report.xlsx');
        await workbook.xlsx.write(res);
        res.status(200).end();
        console.log('Tasks report generated successfully');
    } catch (error) {
        console.error('Error generating tasks report:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const excelUsersReport = async (req, res) => {
    try {
        const users = await User.find().select('name email _id').lean();
        const userTasks = await Task.find().populate('assignedTo', 'name email _id').lean();

        const userTaskMap = {};
        users.forEach(user => {
            userTaskMap[user._id] = {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
                taskCount: 0,
                pendingTasks: 0,
                inProgressTasks: 0,
                completedTasks: 0,
            };
        });

        userTasks.forEach(task => {
            if (Array.isArray(task.assignedTo)) {
                task.assignedTo.forEach(assignedUser => {
                    if (userTaskMap[assignedUser._id]) {
                        userTaskMap[assignedUser._id].taskCount += 1;
                        if (task.status === 'Pending') {
                            userTaskMap[assignedUser._id].pendingTasks += 1;
                        } else if (task.status === 'In Progress') {
                            userTaskMap[assignedUser._id].inProgressTasks += 1;
                        } else if (task.status === 'Completed') {
                            userTaskMap[assignedUser._id].completedTasks += 1;
                        }
                    }
                });
            }
        });

        const workbook = new excelJs.Workbook();
        const worksheet = workbook.addWorksheet('Users Report');
        worksheet.columns = [
            { header: 'User ID', key: '_id', width: 30 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Total Tasks', key: 'taskCount', width: 15 },
            { header: 'Pending Tasks', key: 'pendingTasks', width: 15 },
            { header: 'In Progress Tasks', key: 'inProgressTasks', width: 20 },
            { header: 'Completed Tasks', key: 'completedTasks', width: 20 }
        ];

        Object.values(userTaskMap).forEach(user => {
            worksheet.addRow(user);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=users_report.xlsx');
        await workbook.xlsx.write(res);
        res.status(200).end();
        console.log('Users report generated successfully');
    } catch (error) {
        console.error('Error generating users report:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    excelTasksReport,
    excelUsersReport
};
