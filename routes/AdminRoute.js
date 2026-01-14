const { createMember, getMembers, updateMember, getMemberById, setIntroducerHierarchy } = require("../controllers/Admin/Member/index");
const { createAgent, getAgents, updateAgent, getAgentById } = require("../controllers/Admin/Agent/index");
const { createInterest, getInterests, updateInterest, getInterestById } = require("../controllers/Admin/Interest/index");
const { getInterestsByAccountGroup, createAccount, getAccounts, getAccountById, updateAccount, getAccountBooks, getAccountGroups, getPreMaturityAccounts, getPostMaturityAccounts, getAccountTransactions, getAccountsForAssignment, updateAccountAssignment } = require("../controllers/Admin/Account/index");
const { getDashboardCounts, getRecentData } = require("../controllers/Admin/Dashboard/index");
const { migrateExistingMembersHierarchy, migrateExistingAgentsHierarchy } = require("../utils/hierarchyHelper");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");
const { createMaturityPayment } = require("../controllers/Admin/Banking/cashTransaction");

const router = require("express").Router();

// Member routes
router.post('/create-member', Authenticated, authorizeRoles(["ADMIN"]), createMember)
router.get('/get-members', Authenticated, authorizeRoles(["ADMIN"]), getMembers)
router.put('/update-member/:memberId', Authenticated, authorizeRoles(["ADMIN"]), updateMember)
router.get('/get-member/:memberId', Authenticated, authorizeRoles(["ADMIN", 'AGENT']), getMemberById)
router.put('/member/:memberId/set-hierarchy', Authenticated, authorizeRoles(["ADMIN"]), setIntroducerHierarchy)

// 🔧 FIX HIERARCHY - Run to rebuild all member and agent hierarchies
// Add ?force=true to force rebuild even existing hierarchies
router.get('/fix-all-hierarchies', Authenticated, authorizeRoles(["ADMIN"]), async (req, res) => {
    try {
        const forceRebuild = req.query.force === 'true';
        console.log(`\n${"=".repeat(60)}`);
        console.log(`🔧 REBUILDING ALL HIERARCHIES (force: ${forceRebuild})`);
        console.log(`${"=".repeat(60)}\n`);

        const memberResult = await migrateExistingMembersHierarchy(forceRebuild);
        const agentResult = await migrateExistingAgentsHierarchy(forceRebuild);

        console.log(`\n${"=".repeat(60)}`);
        console.log(`✅ HIERARCHY REBUILD COMPLETE`);
        console.log(`   Members: ${memberResult.updated} updated, ${memberResult.skipped || 0} skipped`);
        console.log(`   Agents: ${agentResult.updated} updated, ${agentResult.skipped || 0} skipped`);
        console.log(`${"=".repeat(60)}\n`);

        res.json({
            success: true,
            message: 'All hierarchies rebuilt successfully',
            forceRebuild,
            members: memberResult,
            agents: agentResult
        });
    } catch (error) {
        console.error('Error rebuilding hierarchies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to rebuild hierarchies',
            error: error.message
        });
    }
});

// Agent routes
router.post('/create-agent', Authenticated, authorizeRoles(["ADMIN"]), createAgent)
router.get('/get-agents', Authenticated, authorizeRoles(["ADMIN"]), getAgents)
router.put('/update-agent/:agentId', Authenticated, authorizeRoles(["ADMIN"]), updateAgent)
router.get('/get-agent/:agentId', Authenticated, authorizeRoles(["ADMIN"]), getAgentById)

// Interest routes
router.post('/create-interest', Authenticated, authorizeRoles(["ADMIN"]), createInterest)
router.get('/get-interests', Authenticated, authorizeRoles(["ADMIN"]), getInterests)
router.put('/update-interest/:interestId', Authenticated, authorizeRoles(["ADMIN"]), updateInterest)
router.get('/get-interest/:interestId', Authenticated, authorizeRoles(["ADMIN"]), getInterestById)

// Account routes
router.get('/get-interests-by-account-group/:account_group_id', Authenticated, authorizeRoles(["ADMIN", "AGENT"]), getInterestsByAccountGroup)
router.post('/create-account', Authenticated, authorizeRoles(["ADMIN"]), createAccount)
router.get('/get-accounts', Authenticated, authorizeRoles(["ADMIN"]), getAccounts)
router.get('/get-account/:accountId', Authenticated, authorizeRoles(["ADMIN"]), getAccountById)
router.put('/update-account/:accountId', Authenticated, authorizeRoles(["ADMIN"]), updateAccount)
router.get('/get-account-books', Authenticated, authorizeRoles(["ADMIN", "AGENT"]), getAccountBooks)
router.get('/get-account-groups', Authenticated, authorizeRoles(["ADMIN", "AGENT"]), getAccountGroups)
router.get('/get-pre-maturity-accounts', Authenticated, authorizeRoles(["ADMIN"]), getPreMaturityAccounts)
router.get('/get-post-maturity-accounts', Authenticated, authorizeRoles(["ADMIN"]), getPostMaturityAccounts)
router.get('/accounts/transactions/:memberId', Authenticated, authorizeRoles(["ADMIN"]), getAccountTransactions)

// Agent Assignment routes
router.get('/get-accounts-for-assignment', Authenticated, authorizeRoles(["ADMIN"]), getAccountsForAssignment)
router.put('/update-account-assignment/:accountId', Authenticated, authorizeRoles(["ADMIN"]), updateAccountAssignment)

// Dashboard routes
router.get('/get-dashboard-counts', Authenticated, authorizeRoles(["ADMIN"]), getDashboardCounts)
router.get('/get-recent-data', Authenticated, authorizeRoles(["ADMIN"]), getRecentData)
router.post("/maturity-payment", Authenticated, authorizeRoles(["ADMIN"]), createMaturityPayment);

module.exports = router;
