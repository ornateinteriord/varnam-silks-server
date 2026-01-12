const cron = require("node-cron");
const AccountsModel = require("../models/accounts.model");
const TransactionModel = require("../models/transaction.model");
const generateTransactionId = require("./generateTransactionId");

/**
 * Process matured accounts - calculates interest and creates transaction records
 * This function finds all accounts where date_of_maturity has passed and
 * maturity_processed is false, then updates them with interest calculations
 */
const processMaturedAccounts = async () => {
    console.log("⏰ [Maturity Scheduler] Starting maturity processing check...");

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        // Find accounts where maturity date has passed and not yet processed
        const maturedAccounts = await AccountsModel.find({
            date_of_maturity: { $lt: today }, // Maturity date is before today
            maturity_processed: { $ne: true }, // Not yet processed
            status: { $nin: ["closed", "inactive"] }, // Only active accounts
            account_amount: { $gt: 0 }, // Has some amount
            interest_rate: { $gt: 0 }, // Has interest rate defined
        });

        console.log(`📋 [Maturity Scheduler] Found ${maturedAccounts.length} matured account(s) to process`);

        let processedCount = 0;
        let errorCount = 0;

        for (const account of maturedAccounts) {
            try {
                // Calculate interest and net amount
                const interestAmount = (account.account_amount * account.interest_rate) / 100;
                const netAmount = account.account_amount + interestAmount;

                console.log(`💰 [Maturity Scheduler] Processing account ${account.account_id}:`);
                console.log(`   Principal: ${account.account_amount}, Rate: ${account.interest_rate}%`);
                console.log(`   Interest: ${interestAmount}, Net Amount: ${netAmount}`);

                // Update account with interest details
                await AccountsModel.findByIdAndUpdate(account._id, {
                    interest_amount: interestAmount,
                    net_amount: netAmount,
                    maturity_processed: true,
                });

                // Generate transaction ID and create transaction record
                const transactionId = await generateTransactionId();

                await TransactionModel.create({
                    transaction_id: transactionId,
                    transaction_date: new Date(),
                    member_id: account.member_id,
                    account_number: account.account_no,
                    account_type: account.account_type,
                    transaction_type: "Interest Credit",
                    description: `Maturity Interest - Account ${account.account_no} matured on ${account.date_of_maturity.toISOString().split('T')[0]}`,
                    credit: interestAmount,
                    debit: 0,
                    balance: netAmount,
                    status: "Completed",
                    reference_no: account.account_id,
                });

                console.log(`✅ [Maturity Scheduler] Successfully processed account ${account.account_id}`);
                processedCount++;
            } catch (accountError) {
                console.error(`❌ [Maturity Scheduler] Error processing account ${account.account_id}:`, accountError.message);
                errorCount++;
            }
        }

        console.log(`📊 [Maturity Scheduler] Processing complete. Success: ${processedCount}, Errors: ${errorCount}`);

        return {
            success: true,
            processed: processedCount,
            errors: errorCount,
            total: maturedAccounts.length,
        };
    } catch (error) {
        console.error("❌ [Maturity Scheduler] Error in maturity processing:", error.message);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Start the maturity scheduler cron job
 * Runs daily at 00:00 (midnight) server time
 */
const startMaturityScheduler = () => {
    // Cron expression: "0 0 * * *" = At 00:00 (midnight) every day
    cron.schedule("0 0 * * *", async () => {
        console.log("🕛 [Maturity Scheduler] Midnight cron job triggered");
        await processMaturedAccounts();
    });

    console.log("✅ [Maturity Scheduler] Cron job scheduled - runs daily at midnight");
};

module.exports = {
    startMaturityScheduler,
    processMaturedAccounts, // Exported for manual triggering via debug endpoint
};
