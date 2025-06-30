const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = userId  => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {expiresIn: '1d',});
}




// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        
        const { name, email, password, profileImageUrl, adminInviteToken } = req.body;
        
        // Basic validation
        if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please enter all required fields' });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
        }
        


        let role = 'member'; // default role

        if(adminInviteToken && adminInviteToken === process.env.ADMIN_INVITE_TOKEN) {
            role = 'admin'; // if admin invite token is valid, set role to admin
        }

        const salt = await bcrypt.genSalt(10); // generate salt for password hashing
        const hashedPassword = await bcrypt.hash(password, salt); // hash the password

        // Create a new user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            profileImageUrl,
            role,
        });



            res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
            role: user.role,
            token: generateToken(user._id),
            });

    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}




// @desc    Login a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const {email, password} = req.body;
        const user = await User.findOne({email});
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}



// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private (Require JWT)
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}



// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private (Require JWT)
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        if(req.body.password){
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.password, salt);
        }
        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            profileImageUrl: updatedUser.profileImageUrl,
            role: updatedUser.role,
            token: generateToken(updatedUser._id),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}


module.exports = { registerUser, loginUser, getUserProfile, updateUserProfile };

    