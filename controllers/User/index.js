const TransactionModel = require("../../models/transaction.model");

// Get all transactions for a specific user/member
const getUserTransactions = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // Find all transactions for this member
        const transactions = await TransactionModel.find({
            member_id: memberId
        })
            .sort({ createdAt: -1 })
            .select('transaction_id transaction_date account_number transaction_type description credit debit balance status reference_no');

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
