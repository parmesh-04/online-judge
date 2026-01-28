const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true,
        trim: true,
    },
    lastname: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    solvedProblems: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
        default: [],
    },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);