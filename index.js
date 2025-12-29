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
//        🛡️ CORS CONFIG (Supports Vite + ngrok)
// ======================================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://nidhi-ltd.vercel.app"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman / server-to-server

      const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
      const isNgrok = origin.endsWith("ngrok-free.dev");

      if (isLocalhost || isNgrok || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS BLOCKED: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.options("*", cors());

// ======================================================
// ⚠️ IMPORTANT: RAW BODY FOR CASHFREE WEBHOOK
// ======================================================
app.use("/transaction/webhook/cashfree", express.raw({ type: "*/*" }));

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

startServer();
