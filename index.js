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

const app = express();

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

  // Log all incoming requests for debugging
  console.log(`🌐 Incoming ${req.method} to ${req.path} from origin: ${origin || 'No Origin'}`);

  if (origin) {
    // Check if origin is allowed
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isNgrok = origin.endsWith("ngrok-free.dev");
    const isVercel = origin.includes(".vercel.app") || origin.includes(".now.sh");

    if (isLocalhost || isNgrok || isVercel || allowedOrigins.includes(origin)) {
      console.log(`✅ CORS ALLOWED for: ${origin}`);
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
      console.log(`✅ CORS ALLOWED: ${origin}`);
      callback(null, true);
    } else {
      console.error(`❌ CORS BLOCKED: ${origin} not in allowed list`);
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
// ⚠️ IMPORTANT: RAW BODY FOR CASHFREE WEBHOOK
// ======================================================
// Capture raw body before JSON parsing for signature verification
app.use('/transaction/webhook/cashfree', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body.toString('utf8');
  next();
});

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

// ======================================================
//        📌 API ROUTES
// ======================================================
app.use("/auth", AuthRoutes);
app.use("/admin", AdminRoutes);
app.use("/agent", AgentRoutes);
app.use("/user", UserRoutes);
app.use("/member", MemberRoutes);
app.use("/transaction", TransactionRoutes);
app.use("/banking", ReceiptsRoutes);
app.use("/banking", PaymentsRoutes);
app.use("/banking/cash-transactions", CashTransactionRoutes);

// ======================================================
//        🏠 HOME
// ======================================================
app.get("/", (_req, res) => {
  res.send(`🚀 ${process.env.PROJECT_NAME || "MSCS Server"} Running Securely`);
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

// Connect to database before starting server
const startServer = async () => {
  try {
    // Ensure MongoDB is connected before accepting requests
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🌍 Server running on port http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start server only if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}

// Export for Vercel serverless
module.exports = app;