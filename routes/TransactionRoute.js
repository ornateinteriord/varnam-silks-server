const express = require("express");
const router = express.Router();
const { getTransactions, addTransaction, getAllTransactions, createPaymentOrder, handleCashfreeWebhook, checkPaymentStatus, transferMoney, requestWithdraw } = require("../controllers/Transaction/TransactionController");
const Authenticated = require("../middlewares/auth");

// Unified Transaction Routes
router.post('/add', Authenticated, addTransaction); // /transaction/add
router.get('/member/:id', Authenticated, getTransactions); // /transaction/member/:id
router.get('/all', Authenticated, getAllTransactions); // /transaction/all (Admin)

// Money Transfer
router.post('/transfer-money', Authenticated, transferMoney); // /transaction/transfer-money

// Withdraw Request
router.post('/withdraw-request', Authenticated, requestWithdraw); // /transaction/withdraw-request

// Cashfree Routes
router.post('/create-order', Authenticated, createPaymentOrder);
// Note: webhook route is handled in index.js BEFORE middleware stack
router.get('/status/:orderId', Authenticated, checkPaymentStatus);

module.exports = router;
