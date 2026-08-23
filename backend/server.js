require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const authRoutes      = require('./routes/auth');
const callLogRoutes   = require('./routes/callLogs');
const leadFunnelRoutes = require('./routes/leadFunnel');
const workforceSummaryRoutes = require('./routes/workforceSummary');
const agentDetailRoutes      = require('./routes/agentDetail');
const retryQueueRoutes       = require('./routes/retryQueue');
const leadRoutes      = require('./routes/leads');
const leadPoolRoutes  = require('./routes/leadPool');
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

// Agents in one office share a single public IP, so per-IP limiting counts the whole floor as
// one client — a few phones with the Live Data tab open can exhaust the shared budget and start
// 429ing call sync and login too. Bucket on the authenticated user instead, falling back to IP
// only for requests with no (or no valid) bearer token. This is a bucketing decision, not an
// auth decision — jwt.decode() reads the payload without checking the signature, so a forged
// token can at worst land the sender in someone else's bucket, which grants them nothing.
// Verification stays where it already lives, in middleware/auth.js.
function apiKeyGenerator(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(authHeader.slice(7));
      if (decoded && decoded.id) return `u:${decoded.id}`;
    } catch {
      // Malformed token — fall through to the IP bucket below rather than 500ing the request.
    }
  }
  return `ip:${req.ip}`;
}

// Meta's lead-ads webhook is unauthenticated (gated by X-Webhook-Token, not a JWT) and every
// lead arrives from the same relay IP, so it must never share a bucket with the rest of that
// IP's traffic — see leadPoolLimiter below. req.path is router-relative once mounted under
// '/api/lead-pool', but full-path for the global '/api/' mount, so both are checked.
const skipWebhook = (req) => req.path === '/meta-webhook' || req.originalUrl.startsWith('/api/lead-pool/meta-webhook');

const limiter        = rateLimit({
  windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false,
  keyGenerator: apiKeyGenerator,
  skip: skipWebhook,
  message: { success: false, error: 'Too many requests. Please wait a moment and try again.' },
});
const authLimiter    = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  keyGenerator: apiKeyGenerator,
  message: { success: false, error: 'Too many login attempts. Please wait a few minutes and try again.' },
});
// 5 registrations per hour — prevents bulk account creation via the protected route
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, keyGenerator: apiKeyGenerator });
// Reports run heavy aggregations; cap at 30 per 5 minutes
const reportsLimiter  = rateLimit({ windowMs:  5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
// File generation/registration; cap at 60 per 5 minutes
const downloadsLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
// The Live Data tab polls this pair every 12s per phone, so it needs its own budget rather
// than eating into the general /api/ allowance shared with sync, reports and exports.
// These two handlers are a single indexed find and a small aggregate — cheap enough that a
// high ceiling here costs far less than a rate-limited pool that looks broken to agents.
const leadPoolLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: apiKeyGenerator,
  skip: skipWebhook,
});

app.use('/api/', limiter);
app.use('/api/lead-pool', leadPoolLimiter);
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
app.use('/api/leads',      workforceSummaryRoutes);
app.use('/api/leads',      agentDetailRoutes);
app.use('/api/leads',      retryQueueRoutes);
app.use('/api/leads',      leadRoutes);
app.use('/api/lead-pool',  leadPoolRoutes);
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

// ── Auto-recycle sweep ─────────────────────────────────────────────────────────
// PM2 runs this API in cluster mode, so every worker would otherwise run its own timer and the
// same lead would get recycled N times per sweep. NODE_APP_INSTANCE is set by PM2 in cluster
// mode (undefined under a plain `node server.js`), so this also does the right thing locally.
const isSweepWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
const RECYCLE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const RECYCLE_SWEEP_STARTUP_DELAY_MS = 60 * 1000;

async function runRecycleSweepSafely() {
  try {
    await connectDB();
    const result = await leadPoolRoutes.runRecycleSweep();
    if (result.recycled) console.log(`[recycle-sweep] recycled ${result.recycled} of ${result.candidates} candidate(s)`);
  } catch (err) {
    // An unhandled rejection inside a setInterval callback would take down the process — this
    // sweep runs forever, so a bad tick must just get logged and retried next interval.
    console.error('[recycle-sweep] failed:', err.message);
  }
}

if (isSweepWorker) {
  setTimeout(() => {
    runRecycleSweepSafely();
    setInterval(runRecycleSweepSafely, RECYCLE_SWEEP_INTERVAL_MS);
  }, RECYCLE_SWEEP_STARTUP_DELAY_MS);
}

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  mongoose.connect(process.env.MONGO_URI).then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = app;