const express = require("express");
const router = express.Router();
const { getAgentById } = require("../controllers/Admin/Agent");
const { createAccount } = require("../controllers/Admin/Account");
const { getAssignedAccounts, collectPayment, makePayment, getCollectionTransactions, getCommissionTransactions, withdrawCommission } = require("../controllers/Agent");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");


router.get('/get-agent/:agentId', Authenticated, authorizeRoles(["AGENT"]), getAgentById)
router.post('/create-account', Authenticated, authorizeRoles(["AGENT"]), createAccount)
router.get('/get-assigned-accounts/:agentId', Authenticated, authorizeRoles(["AGENT"]), getAssignedAccounts)
router.get('/get-collection-transactions/:agentId', Authenticated, authorizeRoles(["AGENT"]), getCollectionTransactions)
router.post('/collect-payment/:agentId', Authenticated, authorizeRoles(["AGENT"]), collectPayment)
router.post('/make-payment/:agentId', Authenticated, authorizeRoles(["AGENT"]), makePayment)

// Commission routes
router.get('/get-commission-transactions/:agentId', Authenticated, authorizeRoles(["AGENT"]), getCommissionTransactions)
router.post('/withdraw-commission/:agentId', Authenticated, authorizeRoles(["AGENT"]), withdrawCommission)

module.exports = router;