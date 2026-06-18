const express = require("express");
const router = express.Router();
const { getUserTransactions, getCommissionTransactions, getSponsers, getMultiLevelSponsors } = require("../controllers/User");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");

router.get('/get-user-transactions/:memberId', Authenticated, authorizeRoles(["USER"]), getUserTransactions);
router.get('/get-commission-transactions/:memberId', Authenticated, authorizeRoles(["USER"]), getCommissionTransactions);
router.get('/sponsers/:memberId', Authenticated, authorizeRoles(["USER"]), getSponsers);
router.get('/multi-level-sponsors', Authenticated, authorizeRoles(["USER", "AGENT"]), getMultiLevelSponsors);

module.exports = router;
