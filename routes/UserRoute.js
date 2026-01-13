const express = require("express");
const router = express.Router();
const { getUserTransactions, getCommissionTransactions } = require("../controllers/User");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");

router.get('/get-user-transactions/:memberId', Authenticated, authorizeRoles(["USER"]), getUserTransactions);
router.get('/get-commission-transactions/:memberId', Authenticated, authorizeRoles(["USER"]), getCommissionTransactions);

module.exports = router;
