const TransactionModel = require("../models/transaction.model");

/**
 * Generate a unique transaction ID using timestamp
 * Format: TXN_{timestamp}_{random}
 */
const generateTransactionId = async () => {
    // Use timestamp + random to avoid duplicates
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const newTransactionId = `TXN_${timestamp}_${random}`;

    // Verify it doesn't exist (unlikely but safe)
    const existing = await TransactionModel.findOne({ transaction_id: newTransactionId });
    if (existing) {
        // If by chance it exists, add more randomness
        return `TXN_${timestamp}_${random}_${Math.floor(Math.random() * 10000)}`;
    }

    return newTransactionId;
};

module.exports = generateTransactionId;
