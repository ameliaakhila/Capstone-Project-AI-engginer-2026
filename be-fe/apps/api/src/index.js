import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import dashboardRoutes from './routes/dashboard.routes.js';
import districtRoutes from './routes/districts.routes.js';
import entityRoutes from './routes/entities.routes.js';
import violationRoutes from './routes/violations.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import searchRoutes from './routes/search.routes.js';
import authRoutes from './routes/auth.routes.js';
import testRoutes from './routes/test.routes.js';
import zoningRoutes from './routes/zoning.routes.js';
import auditRoutes from './routes/audit.routes.js';
import aiRoutes from './routes/ai.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS origins from env-var (comma-separated). Empty/unset → allow all for local dev.
const allowedOrigins = process.env.ALLOWED_ORIGINS;
const corsOptions = allowedOrigins
  ? { origin: allowedOrigins.split(',').map((o) => o.trim()), credentials: true }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));

app.use(express.json());
app.use(morgan('dev'));

// ─── API Routes ─────────────────────────────────────────
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/districts', districtRoutes);
app.use('/api/v1/entities', entityRoutes);
app.use('/api/v1/violations', violationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/zoning', zoningRoutes);
app.use('/api/v1/audits', auditRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

// route untuk test middleware authenticate dan isAdmin
app.use('/api/v1/test', testRoutes);

// ─── Health Check ───────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── 404 Handler ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route tidak ditemukan',
    path: req.originalUrl,
  });
});

// ─── Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  // Log full error details for debugging
  console.error('❌ Error on', req.method, req.originalUrl);
  console.error('  message:', err.message || '(no message)');
  console.error('  code:   ', err.code || '(no code)');
  if (err.response) {
    // Axios HTTP error from upstream
    console.error('  upstream status:', err.response.status);
    console.error('  upstream body:  ', JSON.stringify(err.response.data));
  }
  if (err.request && !err.response) {
    // Axios network error (ECONNREFUSED, ENOTFOUND, etc.)
    console.error('  network error - no response received');
    console.error('  request URL:', err.config?.url || '?');
  }
  console.error('  stack:', err.stack);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// ─── Start Server ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Zonify API running at http://localhost:${PORT}`);
  console.log(` API Base: http://localhost:${PORT}/api/v1`);
  console.log(` Health:   http://localhost:${PORT}/api/v1/health`);
  console.log(` Auth:     http://localhost:${PORT}/api/v1/auth`);
  console.log(` AI:       http://localhost:${PORT}/api/v1/ai`);
  console.log(` Test:     http://localhost:${PORT}/api/v1/test\n`);
});