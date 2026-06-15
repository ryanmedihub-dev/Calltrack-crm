require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const callLogRoutes = require('./routes/callLogs');
const leadRoutes    = require('./routes/leads');
const reportRoutes  = require('./routes/reports');
const auditRoutes   = require('./routes/auditLog');
const scriptRoutes  = require('./routes/scripts');
const { protect, isManager } = require('./middleware/auth');
const User = require('./models/User');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.match(/^http:\/\/localhost:\d+$/)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

const limiter        = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });
// 5 registrations per hour — prevents bulk account creation via the protected route
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
// Reports run heavy aggregations; cap at 30 per 5 minutes
const reportsLimiter  = rateLimit({ windowMs:  5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/reports', reportsLimiter);

// Fail immediately if not connected — no silent 10s buffering
mongoose.set('bufferCommands', false);

async function connectDB() {
  // Already live — nothing to do
  if (mongoose.connection.readyState === 1) return;

  // Reuse cached promise across Vercel warm-start invocations
  if (!global._mongoConnPromise) {
    global._mongoConnPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
  }

  try {
    await global._mongoConnPromise;
  } catch (err) {
    global._mongoConnPromise = null; // reset so next request retries
    throw err;
  }
}

app.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection error:', err.message);
    return res.status(503).json({ success: false, error: 'Service temporarily unavailable. Please try again in a moment.' });
  }
});

app.use('/api/auth',       authRoutes);
app.use('/api/calls',      callLogRoutes);
app.use('/api/leads',      leadRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/scripts',    scriptRoutes);

// employees
app.get('/api/employees', protect, isManager, async (req, res) => {
  try {
    const { search, page = 1, limit = 200 } = req.query;
    const filter = { role: 'employee' };
    if (search) filter.name = { $regex: search, $options: 'i' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [employees, total] = await Promise.all([
      User.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);
    return res.json({ success: true, data: employees, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/employees', protect, isManager, async (req, res) => {
  try {
    const { name, email, password, phone, deviceId } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });
    const user = await User.create({ name, email, password, role: 'employee', phone, deviceId });
    return res.status(201).json({ success: true, data: user, message: 'Employee created' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/employees/:id', protect, isManager, async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/employees/:id/status', protect, isManager, async (req, res) => {
  try {
    const { isActive } = req.body;
    const employee = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/employees/:id/target', protect, isManager, async (req, res) => {
  try {
    const { dailyTarget } = req.body;
    if (typeof dailyTarget !== 'number' || dailyTarget < 0) {
      return res.status(400).json({ success: false, error: 'dailyTarget must be a non-negative number' });
    }
    const employee = await User.findByIdAndUpdate(req.params.id, { dailyTarget }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/fcm-token', protect, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ success: false, error: 'fcmToken required' });
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    return res.json({ success: true, message: 'FCM token saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/employees/:id', protect, isManager, async (req, res) => {
  try {
    const { name, phone, deviceId } = req.body;
    const employee = await User.findByIdAndUpdate(req.params.id, { name, phone, deviceId }, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/employees/:id', protect, isManager, async (req, res) => {
  try {
    const employee = await User.findOneAndDelete({ _id: req.params.id, role: 'employee' });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'CallTrack API running' }));

app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  mongoose.connect(process.env.MONGO_URI).then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = app;
