require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    methods: ["GET","PUT","POST","DELETE"],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Connect to MongoDB
connectDB();

// middleware to parse JSON bodies
app.use(express.json());



// Serve static files from the React app

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/reports", reportRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));



// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {console.log(`Server is running on port ${PORT}`);});