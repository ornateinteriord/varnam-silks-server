const express = require("express");
const router = express.Router();
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");
const { getMemberById } = require("../controllers/Admin/Member");
const { getMyAccounts, updateMyProfile, getMemberBasicInfo, getMemberAccountsPublic, getMemberTransactions } = require("../controllers/Member");

router.get('/get-member/:memberId', Authenticated, authorizeRoles(["USER"]), getMemberById)

// Member dashboard routes  
router.get('/get-my-accounts', Authenticated, authorizeRoles(["USER"]), getMyAccounts);

// Update member profile
router.put('/update-profile/:memberId', Authenticated, authorizeRoles(["USER"]), updateMyProfile);

// Transfer-related routes (for recipient lookup)
router.get('/basic-info/:memberId', Authenticated, authorizeRoles(["USER"]), getMemberBasicInfo);
router.get('/accounts/:memberId', Authenticated, authorizeRoles(["USER"]), getMemberAccountsPublic);

// Get member transactions (with optional account_type filter)
router.get('/transactions/:memberId', Authenticated, authorizeRoles(["USER"]), getMemberTransactions);

module.exports = router;