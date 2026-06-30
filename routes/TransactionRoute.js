const express = require("express");
const router = express.Router();
console.log("TransactionRoute.js loaded"); // DEBUG LOG

router.get('/test-route', (req, res) => {
    res.json({ message: "Transaction route is working" });
});
const { getTransactions, addTransaction, getAllTransactions, createPaymentOrder, handleRazorpayWebhook, checkPaymentStatus, transferMoney, requestWithdraw, triggerTestWebhook, testPaymentStatus } = require("../controllers/Transaction/TransactionController");
const { withdrawCommission, getWithdrawalRequests, approveWithdrawal } = require("../controllers/Transaction/WithdrawalController");
const { submitKYC, getKycSubmissions } = require("../controllers/KYC/KycController");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");

// Unified Transaction Routes
router.post('/add', Authenticated, addTransaction); // /transaction/add
router.get('/member/:id', Authenticated, getTransactions); // /transaction/member/:id
router.get('/all', Authenticated, getAllTransactions); // /transaction/all (Admin)

// Money Transfer
router.post('/transfer-money', Authenticated, transferMoney); // /transaction/transfer-money

// Withdraw Request
router.post('/withdraw-request', Authenticated, requestWithdraw); // /transaction/withdraw-request
router.post('/withdraw-commission', Authenticated, authorizeRoles(["USER", "AGENT"]), withdrawCommission);

// Admin Withdrawal Management
router.get('/withdrawal-requests', Authenticated, authorizeRoles(["ADMIN"]), getWithdrawalRequests);
router.post('/approve-withdrawal', Authenticated, authorizeRoles(["ADMIN"]), approveWithdrawal);

// Razorpay Routes
router.post('/create-order', createPaymentOrder);
// ⚠️ WEBHOOK ROUTE REMOVED - Handled in index.js (BEFORE other middleware for raw body)
// Webhook is at: POST /transaction/webhook/razorpay (defined in index.js line 29)
router.get('/status/:orderId', Authenticated, checkPaymentStatus);

// Test Webhook Routes
router.post('/test/webhook', Authenticated, triggerTestWebhook);
router.put('/test/payment/:orderId/success', Authenticated, testPaymentStatus);

// KYC Routes
router.post('/kyc/submit', submitKYC); // /transaction/kyc/submit
// router.post('/kyc/approve', Authenticated, authorizeRoles(["ADMIN"]), approveKYC); // /transaction/kyc/approve
// router.get('/kyc/submissions', Authenticated, authorizeRoles(["ADMIN"]), getKycSubmissions); // /transaction/kyc/submissions

// Diagnostic endpoint to check Razorpay configuration
router.get('/razorpay-config', Authenticated, (req, res) => {
    const razorpayConfig = require("../utils/razorpay");
    res.json({
        environment: razorpayConfig.NODE_ENV,
        isProduction: razorpayConfig.IS_PRODUCTION,
        isSandbox: razorpayConfig.IS_SANDBOX,
        keyIdConfigured: !!razorpayConfig.RAZORPAY_KEY_ID,
        keyIdLength: razorpayConfig.RAZORPAY_KEY_ID?.length || 0,
        secretKeyConfigured: !!razorpayConfig.RAZORPAY_KEY_SECRET,
        secretKeyLength: razorpayConfig.RAZORPAY_KEY_SECRET?.length || 0,
        webhookSecretConfigured: !!razorpayConfig.RAZORPAY_WEBHOOK_SECRET
    });
});

module.exports = router;