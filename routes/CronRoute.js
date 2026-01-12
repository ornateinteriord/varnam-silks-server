const express = require("express");
const router = express.Router();
const { processMaturedAccounts } = require("../utils/maturityScheduler");

/**
 * Middleware to verify Vercel Cron Secret
 * Vercel sends a header: Authorization: Bearer <CRON_SECRET>
 */
const verifyCronSecret = (req, res, next) => {
    // Skip verification in development if explicitly allowed (optional)
    if (process.env.NODE_ENV === "development" && process.env.SKIP_CRON_AUTH === "true") {
        return next();
    }

    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error("❌ CRON_SECRET is not defined in environment variables");
        return res.status(500).json({ error: "Server misconfiguration: CRON_SECRET missing" });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: "Unauthorized: Invalid Cron Secret" });
    }

    next();
};

// ==========================================
// CRON JOB ENDPOINT (For Vercel)
// ==========================================
// Path: /api/cron/process-maturity
router.get("/process-maturity", verifyCronSecret, async (req, res) => {
    try {
        console.log("⏰ Vercel Cron Job Triggered: Maturity Processing");

        const result = await processMaturedAccounts();

        return res.status(200).json({
            success: true,
            message: "Cron job executed successfully",
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("❌ Cron Job Error:", error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
