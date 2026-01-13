const TransactionModel = require("../../models/transaction.model");
const CommissionModel = require("../../models/commission.model");
const MemberModel = require("../../models/member.model");

// Get all transactions for a specific user/member
const getUserTransactions = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { account_type } = req.query;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // Build query filter
        const filter = { member_id: memberId };
        if (account_type) {
            filter.account_type = account_type;
        }

        // Find all transactions for this member (optionally filtered by account type)
        const transactions = await TransactionModel.find(filter)
            .sort({ transaction_date: -1 })
            .select('transaction_id transaction_date account_number account_type transaction_type description credit debit balance status reference_no');

        res.status(200).json({
            success: true,
            message: "User transactions fetched successfully",
            data: transactions
        });
    } catch (error) {
        console.error("Error fetching user transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user transactions",
            error: error.message
        });
    }
};

// Get all commission transactions for a member
const getCommissionTransactions = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // Get member details for commission_balance
        const member = await MemberModel.findOne({ member_id: memberId });
        const commissionBalance = member ? (member.commission_balance || 0) : 0;

        // Find all commission transactions where this member is the beneficiary
        const commissions = await CommissionModel.find({
            beneficiary_id: memberId
        }).sort({ createdAt: -1 });

        // Calculate summary statistics
        const totalEarned = commissions
            .filter(c => c.status === "CREDITED")
            .reduce((sum, c) => sum + c.commission_amount, 0);

        const totalPending = commissions
            .filter(c => c.status === "PENDING")
            .reduce((sum, c) => sum + c.commission_amount, 0);

        const totalWithdrawn = commissions
            .filter(c => c.status === "WITHDRAWN")
            .reduce((sum, c) => sum + c.commission_amount, 0);

        res.status(200).json({
            success: true,
            message: "Commission transactions fetched successfully",
            data: {
                transactions: commissions,
                summary: {
                    totalEarned,
                    totalPending,
                    totalWithdrawn,
                    availableBalance: totalEarned - totalWithdrawn // Calculate from transactions
                }
            }
        });
    } catch (error) {
        console.error("Error fetching commission transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch commission transactions",
            error: error.message
        });
    }
};

module.exports = {
    getUserTransactions,
    getCommissionTransactions
};
