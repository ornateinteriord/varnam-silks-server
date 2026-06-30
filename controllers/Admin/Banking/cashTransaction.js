const CashTransactionModel = require("../../../models/cashTransaction.model");
const AccountsModel = require("../../../models/accounts.model");
const MemberModel = require("../../../models/member.model");
const TransactionModel = require("../../../models/transaction.model");
const axios = require("axios");
const generateTransactionId = require("../../../utils/generateTransactionId");
const razorpayConfig = require("../../../utils/razorpay");

/**
 * Get all cash transactions with balance calculations
 */
const getAllCashTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;

        // Build filter
        const filter = { status: { $ne: 'inactive' } };

        if (search) {
            filter.$or = [
                { cash_transaction_id: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { reference_no: { $regex: search, $options: 'i' } },
                { voucher_no: { $regex: search, $options: 'i' } }
            ];
        }

        // Get all transactions sorted by date
        const allTransactions = await CashTransactionModel.find(filter).sort({ transaction_date: 1, createdAt: 1 });

        // Calculate balances
        let runningBalance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        const transactionsWithBalance = allTransactions.map((transaction) => {
            const debit = transaction.debit || 0;
            const credit = transaction.credit || 0;

            totalDebit += debit;
            totalCredit += credit;

            // Credit increases balance, debit decreases balance
            runningBalance += credit - debit;

            return {
                ...transaction.toObject(),
                balance: runningBalance
            };
        });

        // Calculate opening and closing balances
        const openingBalance = 0; // Assuming opening balance is 0
        const closingBalance = runningBalance;

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedTransactions = transactionsWithBalance.slice(startIndex, endIndex);

        return res.status(200).json({
            success: true,
            message: "Cash transactions fetched successfully",
            data: paginatedTransactions,
            summary: {
                openingBalance,
                debitAmount: totalDebit,
                creditAmount: totalCredit,
                closingBalance
            },
            pagination: {
                total: transactionsWithBalance.length,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(transactionsWithBalance.length / limit)
            }
        });
    } catch (error) {
        console.error("Error in getAllCashTransactions:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch cash transactions",
            error: error.message
        });
    }
};

/**
 * Get cash transaction by ID
 */
const getCashTransactionById = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await CashTransactionModel.findOne({
            cash_transaction_id: id,
            status: { $ne: 'inactive' }
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Cash transaction not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cash transaction fetched successfully",
            data: transaction
        });
    } catch (error) {
        console.error("Error in getCashTransactionById:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch cash transaction",
            error: error.message
        });
    }
};

/**
 * Create cash transaction
 */
const createCashTransaction = async (req, res) => {
    try {
        const {
            transaction_date,
            description,
            reference_no,
            credit,
            debit,
            voucher_no,
            branch_id
        } = req.body;

        // Generate cash transaction ID
        const count = await CashTransactionModel.countDocuments();
        const cash_transaction_id = `CASH${String(count + 1).padStart(4, '0')}`;

        const newTransaction = new CashTransactionModel({
            cash_transaction_id,
            transaction_date,
            description,
            reference_no,
            credit,
            debit,
            voucher_no,
            branch_id,
            status: "active"
        });

        await newTransaction.save();

        return res.status(201).json({
            success: true,
            message: "Cash transaction created successfully",
            data: newTransaction
        });
    } catch (error) {
        console.error("Error in createCashTransaction:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create cash transaction",
            error: error.message
        });
    }
};

/**
 * Soft delete cash transaction
 */
const deleteCashTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        const transaction = await CashTransactionModel.findOneAndUpdate(
            { cash_transaction_id: id },
            { $set: { status: "inactive" } },
            { new: true }
        );

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Cash transaction not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cash transaction deleted successfully",
            data: transaction
        });
    } catch (error) {
        console.error("Error in deleteCashTransaction:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete cash transaction",
            error: error.message
        });
    }
};

/**
 * Create maturity payment with Cashfree Payout
 */
const createMaturityPayment = async (req, res) => {
    try {
        const {
            account_id,
            account_no,
            account_type,
            member_id,
            amount,
            payment_method = 'online', // 'online', 'cash', 'cheque'
            description,
            reference_no,
            voucher_no,
            branch_id
        } = req.body;

        // Validate required fields
        if (!account_id || !account_no || !account_type || !member_id || !amount) {
            return res.status(400).json({
                success: false,
                message: "Account details, member ID, and amount are required"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than zero"
            });
        }

        // Validate account exists and is matured
        const account = await AccountsModel.findOne({ account_id: account_id });
        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        // Check if account is eligible for maturity (has maturity date and amount)
        if (account.status !== "matured" && account.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Account is not in matured status for payment"
            });
        }

        if (account.account_amount < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient account balance. Available: ₹${account.account_amount}, Requested: ₹${amount}`
            });
        }

        // Validate member exists
        const member = await MemberModel.findOne({ member_id: member_id });
        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        // Process payment based on method
        let payoutResponse = null;
        let payoutStatus = "completed";
        let payoutReference = null;

        if (payment_method === 'online') {
            // Process with RazorpayX Payout
            if (!razorpayConfig.RAZORPAY_KEY_ID || !razorpayConfig.RAZORPAY_KEY_SECRET) {
                return res.status(500).json({
                    success: false,
                    message: "Payout gateway not configured. Contact administrator."
                });
            }

            const auth = {
                username: razorpayConfig.RAZORPAY_KEY_ID,
                password: razorpayConfig.RAZORPAY_KEY_SECRET,
            };

            // Step 1: Ensure Contact and Fund Account exist
            let fundAccountId = member.razorpay_fund_account_id;
            
            if (!fundAccountId) {
                console.log("⚠️ Razorpay Fund Account missing for maturity payment, creating inline...");
                try {
                    let contactId = member.razorpay_contact_id;
                    if (!contactId) {
                        const contactRes = await axios.post(
                            "https://api.razorpay.com/v1/contacts",
                            {
                                name: member.name,
                                email: member.emailid || "noemail@example.com",
                                contact: member.contactno,
                                type: "customer",
                                reference_id: member.member_id,
                            },
                            { auth, headers: { "Content-Type": "application/json" } }
                        );
                        contactId = contactRes.data.id;
                        member.razorpay_contact_id = contactId;
                    }

                    const fundRes = await axios.post(
                        "https://api.razorpay.com/v1/fund_accounts",
                        {
                            contact_id: contactId,
                            account_type: "bank_account",
                            bank_account: {
                                name: member.name,
                                ifsc: member.ifsc_code,
                                account_number: member.account_number,
                            },
                        },
                        { auth, headers: { "Content-Type": "application/json" } }
                    );
                    
                    fundAccountId = fundRes.data.id;
                    member.razorpay_fund_account_id = fundAccountId;
                    await member.save();
                    console.log(`✅ Created Fund Account: ${fundAccountId}`);
                } catch (error) {
                    console.error("❌ Failed to create Razorpay Fund Account:", error.response?.data || error.message);
                    return res.status(400).json({
                        success: false,
                        message: "Failed to setup payout account details.",
                        error: error.response?.data || error.message
                    });
                }
            }

            // Step 2: Create transfer payload
            const transferId = `MATURITY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const transferPayload = {
                account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER || "2323230000000000",
                fund_account_id: fundAccountId,
                amount: Math.round(amount * 100), // convert to paise
                currency: "INR",
                mode: "NEFT",
                purpose: "payout",
                queue_if_low_balance: true,
                reference_id: transferId,
                narration: `Maturity payment for account ${account_no}`
            };

            try {
                console.log("💰 Initiating RazorpayX payout transfer...");
                payoutResponse = await axios.post(
                    `https://api.razorpay.com/v1/payouts`,
                    transferPayload,
                    { auth, headers: { "Content-Type": "application/json" } }
                );

                payoutReference = payoutResponse.data.id;
                payoutStatus = payoutResponse.data.status || "processing";
                
                if (payoutStatus === "rejected" || payoutStatus === "failed") {
                    throw new Error(`Payout failed: ${payoutResponse.data.status_details?.description}`);
                }
            } catch (error) {
                console.error("❌ Razorpay payout failed:", error.response?.data || error.message);
                return res.status(400).json({
                    success: false,
                    message: "Payout failed",
                    error: error.response?.data || error.message
                });
            }
        }

        // Update account balance (reduce the amount)
        account.account_amount -= amount;
        if (account.account_amount <= 0) {
            account.status = "closed"; // Close account if balance reaches zero
        }
        await account.save();

        // Create cash transaction record
        const count = await CashTransactionModel.countDocuments();
        const cash_transaction_id = `CASH${String(count + 1).padStart(4, '0')}`;

        const cashTransaction = new CashTransactionModel({
            cash_transaction_id,
            transaction_date: new Date(),
            description: description || `Maturity payment for account ${account_no}`,
            reference_no: reference_no || payoutReference,
            credit: 0,
            debit: amount,
            voucher_no,
            branch_id,
            status: "active",
            payment_method,
            payout_reference: payoutReference,
            payout_status: payoutStatus
        });

        await cashTransaction.save();

        // Create transaction record
        const transactionId = await generateTransactionId();
        const transaction = await TransactionModel.create({
            transaction_id: transactionId,
            transaction_date: new Date(),
            member_id,
            account_number: account_no,
            account_type,
            transaction_type: "Maturity Payment",
            description: description || `Maturity payment for account ${account_no}`,
            credit: 0,
            debit: amount,
            balance: account.account_amount,
            status: "Completed",
            reference_no: reference_no || payoutReference,
            Name: member.name,
            mobileno: member.contactno,
            payment_method,
            payout_reference: payoutReference,
            payout_status: payoutStatus
        });

        // Update account close date if closed
        if (account.status === "closed") {
            account.date_of_close = new Date();
            await account.save();
        }

        return res.status(201).json({
            success: true,
            message: payment_method === 'online'
                ? "Maturity payment processed successfully via Cashfree Payout"
                : "Maturity payment recorded successfully",
            data: {
                cashTransaction,
                transaction,
                account: {
                    ...account.toObject(),
                    new_balance: account.account_amount
                },
                ...(payment_method === 'online' && {
                    payout_response: payoutResponse?.data,
                    payout_reference: payoutReference
                })
            }
        });

    } catch (error) {
        console.error("Error in createMaturityPayment:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process maturity payment",
            error: error.message
        });
    }
};

module.exports = {
    getAllCashTransactions,
    getCashTransactionById,
    createCashTransaction,
    deleteCashTransaction,
    createMaturityPayment
};
