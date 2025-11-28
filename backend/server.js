// Load env vars locally; Render/Vercel will inject env directly
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const availabilityRoutes = require('./routes/availability');
const pinRoutes = require('./routes/pins');

const app = express();
const PORT = process.env.PORT || 5000;

// Behind proxies (Render) so secure cookies work
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// CORS configuration with allow-list (comma-separated origins)
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl) or in allow-list
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);

// Public health check before any generic /api middleware
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TripBoard API is running',
    timestamp: new Date().toISOString()
  });
});

// Auth-protected routes mounted on /api
app.use('/api', availabilityRoutes);
app.use('/api', pinRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
});
