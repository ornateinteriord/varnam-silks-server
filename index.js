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
//        🛡️ CORS CONFIG (Production Ready)
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

console.log("🔐 CORS Allowed Origins:", allowedOrigins);

// CORS OPTIONS - More permissive for serverless environments
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
    const isNgrok = origin.endsWith("ngrok-free.dev");

    if (isLocalhost || isNgrok || allowedOrigins.includes(origin)) {
      console.log(`✅ CORS ALLOWED: ${origin}`);
      callback(null, true);
    } else {
      console.error(`❌ CORS BLOCKED: ${origin}`);
      // Don't throw error, just deny
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin"
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  optionsSuccessStatus: 200, // For legacy browsers
  preflightContinue: false
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicit OPTIONS handler (important for preflight)
app.options("*", cors(corsOptions));

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
//    📷 ImageKit Configuration (Optional but Secure)
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
    environment: process.env.NODE_ENV || "development"
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

// Only start server if not in Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  startServer();
}

// Export for Vercel serverless
module.exports = app;
