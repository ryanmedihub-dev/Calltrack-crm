require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const authRoutes      = require('./routes/auth');
const callLogRoutes   = require('./routes/callLogs');
const leadFunnelRoutes = require('./routes/leadFunnel');
const leadRoutes      = require('./routes/leads');
const reportRoutes    = require('./routes/reports');
const auditRoutes     = require('./routes/auditLog');
const scriptRoutes    = require('./routes/scripts');
const employeeRoutes  = require('./routes/employees');
const downloadRoutes  = require('./routes/downloads');

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
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Download-Job-Id', 'X-Download-Expires-At']
};

app.set('trust proxy', 1);
// Gzips responses — CSV exports compress ~80-90%, cutting download time for the
// Leads/Call Logs export routes far more than any server-side query speedup can.
app.use(compression());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Registering a client-built CSV JSON-escapes its content (inflating wire size up to ~2x),
// so this route needs a bigger body limit than the global one below.
app.use('/api/downloads/register', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '5mb' }));

const limiter        = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const authLimiter    = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please wait a few minutes and try again.' },
});
// 5 registrations per hour — prevents bulk account creation via the protected route
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
// Reports run heavy aggregations; cap at 30 per 5 minutes
const reportsLimiter  = rateLimit({ windowMs:  5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
// File generation/registration; cap at 60 per 5 minutes
const downloadsLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/reports', reportsLimiter);
app.use('/api/downloads', downloadsLimiter);

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
app.use('/api/leads',      leadFunnelRoutes);
app.use('/api/leads',      leadRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/scripts',    scriptRoutes);
app.use('/api/employees',  employeeRoutes);
app.use('/api/downloads',  downloadRoutes);

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