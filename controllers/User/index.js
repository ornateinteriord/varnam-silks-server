const TransactionModel = require("../../models/transaction.model");

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

module.exports = {
    getUserTransactions
};
