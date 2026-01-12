const express = require("express");
const router = express.Router();
const MemberModel = require("../models/member.model");
const TransactionModel = require("../models/transaction.model");
const CommissionModel = require("../models/commission.model");
const AccountsModel = require("../models/accounts.model");

// Diagnostic endpoint to check commission setup for a member
router.get("/commission-debug/:memberId", async (req, res) => {
    try {
        const { memberId } = req.params;

        // Find member
        const member = await MemberModel.findOne({ member_id: memberId });
        if (!member) {
            return res.status(404).json({
                error: "Member not found",
                member_id: memberId
            });
        }

        // Check member's commission eligibility
        const memberInfo = {
            member_id: member.member_id,
            name: member.name,
            commission_eligible: member.commission_eligible,
            introducer_hierarchy: member.introducer_hierarchy || [],
            hierarchy_length: (member.introducer_hierarchy || []).length
        };

        // Get member's accounts
        const accounts = await AccountsModel.find({ member_id: memberId });
        const accountInfo = accounts.map(acc => ({
            account_id: acc.account_id,
            account_no: acc.account_no,
            account_type: acc.account_type,
            balance: acc.account_amount,
            status: acc.status
        }));

        // Get recent transactions
        const transactions = await TransactionModel.find({ member_id: memberId })
            .sort({ createdAt: -1 })
            .limit(5);

        const transactionInfo = transactions.map(tx => ({
            transaction_id: tx.transaction_id,
            amount: tx.credit,
            account_type: tx.account_type,
            status: tx.status,
            payment_status: tx.payment_status,
            webhook_processed: tx.webhook_processed,
            date: tx.transaction_date
        }));

        // Get commissions received
        const commissionsReceived = await CommissionModel.find({
            beneficiary_id: memberId
        }).limit(10);

        // Get commissions generated from this member
        const commissionsGenerated = await CommissionModel.find({
            source_id: memberId
        }).limit(10);

        // Check introducer details
        const introducerDetails = [];
        if (member.introducer_hierarchy && member.introducer_hierarchy.length > 0) {
            for (let i = 0; i < member.introducer_hierarchy.length; i++) {
                const introducerId = member.introducer_hierarchy[i];
                const introducer = await MemberModel.findOne({ member_id: introducerId });

                if (introducer) {
                    introducerDetails.push({
                        level: i + 1,
                        introducer_id: introducerId,
                        name: introducer.name,
                        commission_eligible: introducer.commission_eligible,
                        has_active_account: await AccountsModel.exists({
                            member_id: introducerId,
                            status: "active"
                        })
                    });
                } else {
                    introducerDetails.push({
                        level: i + 1,
                        introducer_id: introducerId,
                        error: "Introducer not found in database"
                    });
                }
            }
        }

        return res.json({
            member: memberInfo,
            accounts: accountInfo,
            recent_transactions: transactionInfo,
            introducer_chain: introducerDetails,
            commissions_received: commissionsReceived.map(c => ({
                commission_id: c.commission_id,
                level: c.level,
                amount: c.commission_amount,
                source: c.source_name,
                status: c.status,
                date: c.transaction_date
            })),
            commissions_generated: commissionsGenerated.map(c => ({
                commission_id: c.commission_id,
                level: c.level,
                beneficiary: c.beneficiary_name,
                amount: c.commission_amount,
                status: c.status,
                date: c.transaction_date
            })),
            diagnosis: {
                can_earn_commission: member.commission_eligible === true,
                has_introducer: (member.introducer_hierarchy || []).length > 0,
                introducer_count: (member.introducer_hierarchy || []).length,
                has_active_account: accounts.some(a => a.status === "active"),
                issues: []
            }
        });

    } catch (error) {
        console.error("Debug endpoint error:", error);
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Check specific transaction commission processing
router.get("/transaction-debug/:transactionId", async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await TransactionModel.findOne({ transaction_id: transactionId });
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        // Get associated commissions
        const commissions = await CommissionModel.find({ transaction_id: transactionId });

        // Load commission config
        const { loadCommissionConfig, validateCommissionEligibility } = require("../utils/commissionUtils");
        const config = loadCommissionConfig();

        // Check eligibility
        const eligibility = validateCommissionEligibility(transaction, config);

        return res.json({
            transaction: {
                transaction_id: transaction.transaction_id,
                member_id: transaction.member_id,
                amount: transaction.credit,
                account_type: transaction.account_type,
                status: transaction.status,
                payment_status: transaction.payment_status,
                webhook_processed: transaction.webhook_processed,
                date: transaction.transaction_date
            },
            commission_eligibility: eligibility,
            commissions_created: commissions.map(c => ({
                commission_id: c.commission_id,
                level: c.level,
                beneficiary_id: c.beneficiary_id,
                beneficiary_name: c.beneficiary_name,
                amount: c.commission_amount,
                status: c.status,
                credited_at: c.credited_at
            })),
            commission_config: {
                enabled: config.enabled,
                minimum_amount: config.minimumTransactionAmount,
                eligible_account_types: config.eligibleAccountTypes
            }
        });

    } catch (error) {
        console.error("Transaction debug error:", error);
        return res.status(500).json({
            error: error.message
        });
    }
});

// ==========================================
// TEST WEBHOOK ENDPOINT (for Railway debugging)
// ==========================================
router.post("/test-webhook", async (req, res) => {
    try {
        console.log("🧪 TEST WEBHOOK RECEIVED");
        console.log("📍 Path:", req.path);
        console.log("📦 Body:", JSON.stringify(req.body, null, 2));
        console.log("🏷️ Headers:", JSON.stringify(req.headers, null, 2));

        return res.status(200).json({
            success: true,
            message: "Test webhook received successfully",
            received_data: req.body,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development"
        });
    } catch (error) {
        console.error("❌ Test webhook error:", error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Webhook status check endpoint
router.get("/webhook-status", (req, res) => {
    const cashfreeConfig = require("../utils/cashfree");

    res.json({
        status: "operational",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        webhook_routes: [
            "/transaction/webhook/cashfree",
            "/api/transaction/webhook/cashfree"
        ],
        cashfree_config: {
            base_url: cashfreeConfig.CASHFREE_BASE_URL,
            is_production: cashfreeConfig.IS_PRODUCTION,
            webhook_secret_configured: !!cashfreeConfig.WEBHOOK_SECRET
        }
    });
});

// ==========================================
// MATURITY PROCESSING DEBUG ENDPOINT
// ==========================================
const Authenticated = require("../middlewares/auth");
const authorizeRole = require("../middlewares/authorizeRole");

router.post("/process-maturity", Authenticated, authorizeRole(["super_admin", "admin"]), async (req, res) => {
    try {
        console.log("🧪 Manual maturity processing triggered via debug endpoint");

        const { processMaturedAccounts } = require("../utils/maturityScheduler");
        const result = await processMaturedAccounts();

        return res.status(200).json({
            success: true,
            message: "Maturity processing completed",
            result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("❌ Manual maturity processing error:", error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get matured accounts pending processing
router.get("/matured-accounts", Authenticated, authorizeRole(["super_admin", "admin"]), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maturedAccounts = await AccountsModel.find({
            date_of_maturity: { $lte: today },
            maturity_processed: { $ne: true },
            status: { $nin: ["closed", "inactive"] },
        });

        const processedAccounts = await AccountsModel.find({
            maturity_processed: true,
        }).limit(10).sort({ updatedAt: -1 });

        return res.status(200).json({
            success: true,
            pending_processing: maturedAccounts.map(acc => ({
                account_id: acc.account_id,
                account_no: acc.account_no,
                member_id: acc.member_id,
                account_amount: acc.account_amount,
                interest_rate: acc.interest_rate,
                date_of_maturity: acc.date_of_maturity,
                status: acc.status
            })),
            recently_processed: processedAccounts.map(acc => ({
                account_id: acc.account_id,
                account_no: acc.account_no,
                interest_amount: acc.interest_amount,
                net_amount: acc.net_amount,
                date_of_maturity: acc.date_of_maturity,
                updatedAt: acc.updatedAt
            })),
            pending_count: maturedAccounts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("❌ Error fetching matured accounts:", error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
