const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, isAdmin } = require('../middleware/auth');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Only authenticated admins can register new accounts; role is always 'employee'
router.post('/register', protect, isAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, deviceId } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, role: 'employee', phone, deviceId });
    return res.status(201).json({ success: true, data: { user }, message: 'Account created' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    // Deactivated accounts must not get a token — every protected route rejects
    // !isActive with a 401, which the app shows as "Session Expired" and bounces
    // straight back to the login screen. Fail here with a clear reason instead.
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact your manager.',
      });
    }
    const token = signToken(user._id);
    const userObj = user.toJSON();
    return res.json({ success: true, data: { user: userObj, token }, message: 'Login successful' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    return res.json({ success: true, data: req.user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }
    const user = await User.findById(req.user._id).select('+password');
    const match = await user.comparePassword(currentPassword);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name && !phone) {
      return res.status(400).json({ success: false, error: 'Provide name or phone to update' });
    }
    const update = {};
    if (name) update.name = name.trim();
    if (phone) update.phone = phone.trim();
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    return res.json({ success: true, data: user, message: 'Profile updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/fcm-token
router.post('/fcm-token', protect, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ success: false, error: 'fcmToken required' });
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    return res.json({ success: true, message: 'FCM token saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
