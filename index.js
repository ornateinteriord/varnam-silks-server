// ====================== Imports ======================
const express = require("express");
const cors = require("cors");
require("dotenv").config()
const ImageKit = require("imagekit");
const connectDB = require("./models/db"); // Updated import

// ====================== Routes ======================
const AuthRoutes = require("./routes/AuthRoutes");
const AdminRoutes = require("./routes/AdminRoute");
const AgentRoutes = require("./routes/AgentRoute");
const UserRoutes = require("./routes/UserRoute");
const MemberRoutes = require("./routes/MemberRoute");
const TransactionRoutes = require("./routes/TransactionRoute");
const ReceiptsRoutes = require("./routes/ReceiptsRoute");
const PaymentsRoutes = require("./routes/PaymentsRoute");
const CashTransactionRoutes = require("./routes/CashTransactionRoute");
const DebugRoutes = require("./routes/DebugRoute");

const app = express();

// ======================================================
// ⚠️ CRITICAL: CASHFREE WEBHOOK - MUST BE FIRST
// ======================================================
// Handle Cashfree webhook BEFORE any other middleware
// This route needs raw body for signature verification
const { handleCashfreeWebhook } = require("./controllers/Transaction/TransactionController");

// Webhook middleware with error handling
const webhookMiddleware = [
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    try {
      // Store raw body for signature verification
      req.rawBody = req.body ? req.body.toString('utf8') : '';
      console.log('🔔 Cashfree Webhook Received');
      console.log('📍 Path:', req.path);
      console.log('🏷️ Headers:', JSON.stringify(req.headers, null, 2));
      console.log('📦 Raw Body Length:', req.rawBody?.length || 0);
      next();
    } catch (error) {
      console.error('❌ Webhook Middleware Error:', error.message);
      res.status(500).json({ error: 'Webhook processing failed', message: error.message });
    }
  },
  async (req, res, next) => {
    try {
      await handleCashfreeWebhook(req, res, next);
    } catch (error) {
      console.error('❌ Webhook Handler Error:', error.message);
      console.error('Stack:', error.stack);
      // Always return 200 to Cashfree to prevent retries
      res.status(200).json({ received: true, error: error.message });
    }
  }
];

// Support both /api prefix (Railway/Vercel) and without prefix (local)
app.post('/transaction/webhook/cashfree', ...webhookMiddleware);
app.post('/api/transaction/webhook/cashfree', ...webhookMiddleware);

// ======================================================
//        🛡️ CORS CONFIG (Fixed for Vercel)
// ======================================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_DEV,
  process.env.FRONTEND_URL_PROD,
  "https://nidhi-ltd.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000"
].filter(Boolean);

// Enhanced CORS middleware with better logging
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    // Check if origin is allowed
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isNgrok = origin.endsWith("ngrok-free.dev");
    const isVercel = origin.includes(".vercel.app") || origin.includes(".now.sh");

    if (isLocalhost || isNgrok || isVercel || allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      console.warn(`⚠️ CORS NOT ALLOWED for: ${origin}`);
    }
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Alternative CORS configuration (comment out above if this works better)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, server-side requests)
    if (!origin) {
      console.log('✅ CORS: No origin (server-side request)');
      return callback(null, true);
    }

    // Check if origin is allowed
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isNgrok = origin.endsWith("ngrok-free.dev");
    const isVercel = origin.includes(".vercel.app") || origin.includes(".now.sh");
    const isAllowed = isLocalhost || isNgrok || isVercel || allowedOrigins.includes(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS not allowed for origin: ${origin}`), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-CSRF-Token"
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware (choose one approach)
// app.use(cors(corsOptions));

// ======================================================
//        📦 BODY PARSER (normal APIs)
// ======================================================
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ======================================================
//    📷 ImageKit Configuration
// ======================================================
let imagekit = null;

if (
  process.env.IMAGEKIT_PUBLIC_KEY &&
  process.env.IMAGEKIT_PRIVATE_KEY &&
  process.env.IMAGEKIT_URL_ENDPOINT
) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
  console.log("🖼️ ImageKit initialized");
} else {
  console.warn("⚠️ ImageKit not initialized (missing .env values)");
}

app.get("/image-kit-auth", (_req, res) => {
  if (imagekit) {
    return res.send(imagekit.getAuthenticationParameters());
  }
  return res.status(500).json({ error: "ImageKit not configured" });
});

// ======================================================
//        🏥 CORS HEALTH CHECK
// ======================================================
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    cors: "enabled",
    environment: process.env.NODE_ENV || "development",
    allowedOrigins: allowedOrigins
  });
});

// Test CORS endpoint
app.get("/cors-test", (_req, res) => {
  res.json({
    message: "CORS is working!",
    timestamp: new Date().toISOString(),
    corsHeaders: {
      "Access-Control-Allow-Origin": _req.headers.origin || "Not set",
      "Access-Control-Allow-Credentials": "true"
    }
  });
});

// Webhook status endpoint (browser-friendly GET request)
app.get("/transaction/webhook/cashfree/status", (_req, res) => {
  res.json({
    status: "ready",
    message: "Cashfree webhook endpoint is configured and ready",
    endpoint: "/transaction/webhook/cashfree",
    method: "POST",
    note: "This endpoint only accepts POST requests from Cashfree with valid signatures",
    webhookSecretConfigured: !!process.env.CASHFREE_WEBHOOK_SECRET,
    timestamp: new Date().toISOString()
  });
});

// ======================================================
//        📌 API ROUTES
// ======================================================

// Note: Middleware below is for Vercel serverless ONLY - causes Railway crashes
// Railway uses persistent DB connection established at server startup
// Un-comment this ONLY if deploying to Vercel serverless
/*
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("DB Connection Error in middleware:", error.message);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message
    });
  }
});
*/

app.use("/auth", AuthRoutes);
app.use("/admin", AdminRoutes);
app.use("/agent", AgentRoutes);
app.use("/user", UserRoutes);
app.use("/member", MemberRoutes);
app.use("/transaction", TransactionRoutes);
app.use("/banking", ReceiptsRoutes);
app.use("/banking", PaymentsRoutes);
app.use("/banking/cash-transactions", CashTransactionRoutes);
app.use("/debug", DebugRoutes);

// ======================================================
//        🏠 HOME
// ======================================================
app.get("/", (req, res) => {
  console.log('🏠 Root endpoint hit - server is responding');
  res.status(200).send(`🚀 ${process.env.PROJECT_NAME || "MSCS Server"} Running Securely - Environment: ${process.env.NODE_ENV || "development"}`);
});

// Health check endpoint for Railway
app.get("/health-check", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    message: "Server is running and responding to requests"
  });
});

// ======================================================
//        🚨 ERROR HANDLER (Important for CORS errors)
// ======================================================
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.message);

  // Handle CORS errors specifically
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: err.message,
      allowedOrigins: allowedOrigins
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// ======================================================
//        🚀 Start Server (with DB connection)
// ======================================================
const PORT = process.env.PORT || 5051;

// Connect to database before starting server (for Railway/production)
const startServer = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    // Ensure MongoDB is connected before accepting requests
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🌍 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Webhook endpoints ready!`);
      console.log(`🏠 Listening on 0.0.0.0:${PORT}`);
      console.log(`📡 Server is ready to receive requests`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
};

// Always start server (Railway, local, production)
// Only skip in Vercel serverless environment
if (process.env.VERCEL !== 'true') {
  console.log('🚀 Starting server...');
  console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
  console.log('🔌 PORT:', process.env.PORT || '5051');
  console.log('🌐 MONGO_URI exists:', !!process.env.MONGO_URI);
  console.log('💳 CASHFREE credentials exist:', !!process.env.CASHFREE_SANDBOX_APP_ID || !!process.env.CASHFREE_PRODUCTION_APP_ID);
  startServer();
} else {
  console.log('⚡ Vercel serverless mode - skipping server start');
}

// Export for Vercel serverless
module.exports = app;