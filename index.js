// ====================== Imports ======================
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const ImageKit = require("imagekit");
const connectDB = require("./models/db");

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
const CronRoutes = require("./routes/CronRoute");
const { startMaturityScheduler } = require("./utils/maturityScheduler");

// ====================== Controllers ======================
const {
  handleCashfreeWebhook,
} = require("./controllers/Transaction/TransactionController");

const app = express();

/* =====================================================
   🔔 CASHFREE WEBHOOK — MUST BE FIRST (NO JSON PARSER)
   ===================================================== */

app.post(
  [
    "/transaction/webhook/cashfree",
    "/api/transaction/webhook/cashfree",
  ],
  (req, res, next) => {
    // Capture raw body for signature verification (match BICCSL-Server: type "*/*")
    express.raw({ type: "*/*" })(req, res, () => {
      // express.raw stores the body as a Buffer in req.body
      // Convert it to string and store in req.rawBody for webhook handler
      if (Buffer.isBuffer(req.body)) {
        req.rawBody = req.body.toString('utf8');
      }
      next();
    });
  },
  handleCashfreeWebhook
);

/* =====================================================
   🛡️ CORS CONFIG
   ===================================================== */

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_DEV,
  process.env.FRONTEND_URL_PROD,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow server-to-server (Cashfree, Postman, curl)
  if (!origin) return next();

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
  } else {
    return res.status(403).json({
      error: "CORS Error",
      origin,
      allowedOrigins,
    });
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

/* =====================================================
   📦 BODY PARSER (ALL NORMAL APIs)
   ===================================================== */

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

/* =====================================================
   🖼️ ImageKit
   ===================================================== */

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
}

app.get("/image-kit-auth", (_req, res) => {
  if (!imagekit) {
    return res.status(500).json({ error: "ImageKit not configured" });
  }
  res.send(imagekit.getAuthenticationParameters());
});

/* =====================================================
   🩺 HEALTH CHECKS
   ===================================================== */

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/transaction/webhook/cashfree/status", (_req, res) => {
  res.json({
    status: "ready",
    method: "POST",
    webhookSecretConfigured: !!process.env.CASHFREE_WEBHOOK_SECRET,
  });
});

/* =====================================================
   � DATABASE CONNECTION MIDDLEWARE (for serverless)
   ===================================================== */

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('❌ Database Connection Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed. Please try again.'
    });
  }
});

/* =====================================================
   �📌 API ROUTES
   ===================================================== */

app.use("/auth", AuthRoutes);
app.use("/admin", AdminRoutes);
app.use("/agent", AgentRoutes);
app.use("/user", UserRoutes);
app.use("/member", MemberRoutes);
app.use("/transaction", TransactionRoutes);
app.use("/banking", ReceiptsRoutes);
app.use("/banking", PaymentsRoutes);
app.use("/banking/cash-transactions", CashTransactionRoutes);
app.use("/api/cron", CronRoutes);
app.use("/debug", DebugRoutes);

/* =====================================================
   🏠 ROOT
   ===================================================== */

app.get("/", (_req, res) => {
  res.send(
    `🚀 ${process.env.PROJECT_NAME || "MSCS Server"} running (${process.env.NODE_ENV || "development"})`
  );
});

/* =====================================================
   🚨 GLOBAL ERROR HANDLER
   ===================================================== */

app.use((err, req, res, next) => {
  console.error("🚨 Server Error:", err.message);

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message,
  });
});

/* =====================================================
   🚀 START SERVER (LOCAL / VERCEL)
   ===================================================== */

const PORT = process.env.PORT || 5051;

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🌍 Server running on port ${PORT}`);
      console.log("🔔 Cashfree webhook ready");
    });

    // Start maturity scheduler cron job (runs daily at midnight)
    startMaturityScheduler();
  } catch (error) {
    console.error("❌ Server failed:", error.message);
    process.exit(1);
  }
};

// Start server only if NOT running in Vercel environment
if (process.env.VERCEL !== "1") {
  startServer();
}

module.exports = app;
