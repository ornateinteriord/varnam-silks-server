const { createMember, getMembers, updateMember, getMemberById, setIntroducerHierarchy, deleteMember } = require("../controllers/Admin/Member/index");
const { updatePassword, adminResetPassword } = require("../controllers/Auth/AuthController");
const { createAgent, getAgents, updateAgent, getAgentById, deleteAgent } = require("../controllers/Admin/Agent/index");
const { createInterest, getInterests, updateInterest, getInterestById } = require("../controllers/Admin/Interest/index");
const { getInterestsByAccountGroup, createAccount, getAccounts, getAccountById, updateAccount, getAccountBooks, getAccountGroups, getPreMaturityAccounts, getPostMaturityAccounts, getAccountTransactions, getAccountsForAssignment, updateAccountAssignment } = require("../controllers/Admin/Account/index");
const { getDashboardCounts, getRecentData } = require("../controllers/Admin/Dashboard/index");
const { migrateExistingMembersHierarchy, migrateExistingAgentsHierarchy } = require("../utils/hierarchyHelper");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");
const { createMaturityPayment } = require("../controllers/Admin/Banking/cashTransaction");

const router = require("express").Router();

// Member routes
router.post('/create-member', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), createMember)
router.get('/get-members', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getMembers)
router.put('/update-member/:memberId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), updateMember)
router.get('/get-member/:memberId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01", "AGENT"]), getMemberById)
router.put('/member/:memberId/set-hierarchy', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), setIntroducerHierarchy)
router.delete('/delete-member/:memberId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), deleteMember)

// 🔧 FIX HIERARCHY - Run to rebuild all member and agent hierarchies
// Add ?force=true to force rebuild even existing hierarchies
router.get('/fix-all-hierarchies', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), async (req, res) => {
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
router.post('/create-agent', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), createAgent)
router.get('/get-agents', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getAgents)
router.put('/update-agent/:agentId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), updateAgent)
router.get('/get-agent/:agentId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getAgentById)
router.delete('/delete-agent/:agentId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), deleteAgent)

// Interest routes
router.post('/create-interest', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), createInterest)
router.get('/get-interests', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getInterests)
router.put('/update-interest/:interestId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), updateInterest)
router.get('/get-interest/:interestId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getInterestById)

// Account routes
router.get('/get-interests-by-account-group/:account_group_id', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01", "AGENT"]), getInterestsByAccountGroup)
router.post('/create-account', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), createAccount)
router.get('/get-accounts', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getAccounts)
router.get('/get-account/:accountId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getAccountById)
router.put('/update-account/:accountId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), updateAccount)
router.get('/get-account-books', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01", "AGENT"]), getAccountBooks)
router.get('/get-account-groups', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01", "AGENT"]), getAccountGroups)
router.get('/get-pre-maturity-accounts', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getPreMaturityAccounts)
router.get('/get-post-maturity-accounts', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getPostMaturityAccounts)
router.get('/accounts/transactions/:memberId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getAccountTransactions)

// Agent Assignment routes
router.get('/get-accounts-for-assignment', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getAccountsForAssignment)
router.put('/update-account-assignment/:accountId', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), updateAccountAssignment)

// Dashboard routes
router.get('/get-dashboard-counts', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getDashboardCounts)
router.get('/get-recent-data', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), getRecentData)
router.post("/maturity-payment", Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), createMaturityPayment);

router.put('/update-password', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), updatePassword);
router.put('/reset-account-password', Authenticated, authorizeRoles(["ADMIN", "ADMIN_01"]), adminResetPassword);

module.exports = router;
