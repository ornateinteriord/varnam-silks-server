const TransactionModel = require("../../models/transaction.model");
const cashfreeConfig = require("../../utils/cashfree");
const crypto = require("crypto");
const axios = require("axios");
// Unified format for Transaction ID
const generateTransactionId = () => `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Get Transactions for any Member/Agent
exports.getTransactions = async (req, res) => {
    try {
        const { id } = req.params; // member_id or agent_id

        const transactions = await TransactionModel.find({ member_id: id }).sort({ createdAt: -1 });

        return res.status(200).json({ success: true, data: transactions });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Add Transaction (Unified)
exports.addTransaction = async (req, res) => {
    try {
        const {
            member_id,
            amount,
            transaction_type,
            account_number,
            account_type,
            Name,
            mobileno,
            description,
            reference_no
        } = req.body;

        if (!member_id || !amount || !transaction_type) {
            return res.status(400).json({ success: false, message: "Missing required fields: member_id, amount, transaction_type" });
        }

        let credit = 0;
        let debit = 0;

        // Logic mapping based on user request:
        // 'Money Added', 'App Cash Transfer' -> Credit (Deposit)
        // 'Agent Withdraw', 'Member Withdraw', 'Transfer' -> Debit (Expense)

        const creditTypes = ['Money Added', 'App Cash Transfer'];
        const debitTypes = ['Agent Withdraw', 'Member Withdraw', 'Transfer'];

        if (creditTypes.includes(transaction_type)) {
            credit = Number(amount);
        } else if (debitTypes.includes(transaction_type)) {
            debit = Number(amount);
        } else {
            return res.status(400).json({ success: false, message: "Invalid Transaction Type" });
        }

        // Calculate Balance
        const lastTx = await TransactionModel.findOne({ member_id }).sort({ createdAt: -1 });
        const lastBalance = lastTx ? lastTx.balance : 0;

        if (debit > 0 && lastBalance < debit) {
            return res.status(400).json({ success: false, message: "Insufficient Balance" });
        }

        const newBalance = lastBalance + credit - debit;

        const newTx = new TransactionModel({
            transaction_id: generateTransactionId(),
            transaction_date: new Date(),
            member_id,
            transaction_type,
            account_number,
            account_type,
            Name,
            mobileno,
            description: description || transaction_type,
            credit,
            debit,
            balance: newBalance,
            ew_debit: debit > 0 ? String(debit) : "0",
            status: "Pending",
            reference_no
        });

        await newTx.save();
        return res.status(201).json({ success: true, message: "Transaction Successful", data: newTx });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Get All
exports.getAllTransactions = async (req, res) => {
    try {
        const transactions = await TransactionModel.find({}).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// Cashfree Payment Integration
// ==========================================


// 1. Create Payment Order
exports.createPaymentOrder = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");
    const MemberModel = require("../../models/member.model");

    try {
        const { member_id, amount, mobileno, Name, email, account_id, account_no, account_type } = req.body;

        if (!member_id || !amount || !mobileno || !Name) {
            return res.status(400).json({ success: false, message: "Missing required fields: member_id, amount, mobileno, Name" });
        }

        // Validate account details are provided
        if (!account_id || !account_no || !account_type) {
            return res.status(400).json({
                success: false,
                message: "Missing required account details: account_id, account_no, account_type"
            });
        }

        // Validate member exists and is active
        const allMembers = await MemberModel.find({});
        const member = allMembers.find(m => m.member_id === member_id || m.member_id === parseInt(member_id));

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        if (member.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Member account is not active"
            });
        }

        // Validate account exists and belongs to member
        const allAccounts = await AccountsModel.find({});
        const account = allAccounts.find(acc =>
            (acc.account_id === account_id || acc.account_id === parseInt(account_id)) &&
            (acc.member_id === member_id || acc.member_id === parseInt(member_id)) &&
            (acc.account_no == account_no) &&
            (acc.account_type === account_type)
        );

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found or does not belong to this member"
            });
        }

        // Check if account is active
        if (account.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Account is not active. Cannot add money to inactive account."
            });
        }

        const orderId = `ORDER_${Date.now()}`;

        if (account_id) {
            const AccountsModel = require("../../models/accounts.model");
            const AccountGroupModel = require("../../models/accountGroup.model");

            const account = await AccountsModel.findOne({ account_id: account_id });

            if (account) {
                accountNumber = account.account_no;

                // Fetch account type name from accountGroup
                if (account.account_type) {
                    const accountGroup = await AccountGroupModel.findOne({
                        account_group_id: account.account_type
                    });

                    if (accountGroup && accountGroup.account_group_name) {
                        accountType = accountGroup.account_group_name;
                    }
                }
            }
        }

        // Prepare Request
        const request = {
            order_amount: Number(amount),
            order_currency: "INR",
            order_id: orderId,
            customer_details: {
                customer_id: member_id,
                customer_phone: mobileno,
                customer_name: Name,
                customer_email: email || "customer@example.com"
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/user/wallet?order_id={order_id}&order_status={order_status}&member_id=${member_id}`,
                notify_url: `${process.env.BACKEND_URL || 'http://localhost:5051'}/transaction/webhook/cashfree`  // Use environment variable
            }
        };

        // Log the request being sent to Cashfree
        console.log("=== Creating Cashfree Order ===");
        console.log("Environment:", cashfreeConfig.IS_PRODUCTION ? "PRODUCTION" : "SANDBOX");
        console.log("Base URL:", cashfreeConfig.CASHFREE_BASE_URL);
        console.log("Request Body:", JSON.stringify(request, null, 2));

        // Direct axios call to Cashfree API
        const response = await axios.post(`${cashfreeConfig.CASHFREE_BASE_URL}/pg/orders`, request, {
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': cashfreeConfig.CASHFREE_APP_ID,
                'x-client-secret': cashfreeConfig.CASHFREE_SECRET_KEY,
                'x-api-version': cashfreeConfig.X_API_VERSION
            }
        });

        console.log("=== Cashfree Response ===");
        console.log("Status:", response.status);
        console.log("Response Data:", JSON.stringify(response.data, null, 2));

        // Validate that payment_session_id exists in response
        if (!response.data || !response.data.payment_session_id) {
            console.error("❌ ERROR: payment_session_id not found in Cashfree response!");
            console.error("Full Response:", JSON.stringify(response.data, null, 2));
            throw new Error("Cashfree API did not return a payment_session_id. Please check API credentials and configuration.");
        }

        const paymentSessionId = response.data.payment_session_id;
        console.log("✅ Payment Session ID:", paymentSessionId);
        console.log("============================");

        // Create Pending Transaction in DB with account details
        const newTx = new TransactionModel({
            transaction_id: orderId, // Use Order ID as Transaction ID for mapping
            transaction_date: new Date(),
            member_id,
            account_number: account_no,
            account_type: account_type,
            transaction_type: "Money Added",
            description: `Online Top-up to Account ${account_no} (Pending)`,
            credit: Number(amount),
            debit: 0,
            balance: 0, // Will update on success
            status: "Pending",
            payment_gateway: "Cashfree",
            gateway_order_id: response.data.order_id,
            payment_session_id: paymentSessionId,
            payment_status: "Pending",
            Name,
            mobileno
        });

        await newTx.save();

        return res.status(200).json({
            success: true,
            payment_session_id: paymentSessionId,
            order_id: orderId,
            account_no: account_no
        });

    } catch (error) {
        console.error("=== Cashfree Order Error ===");
        console.error("Error Message:", error.message);
        console.error("Error Response Data:", JSON.stringify(error.response?.data, null, 2));
        console.error("Error Response Status:", error.response?.status);
        console.error("Error Response Headers:", JSON.stringify(error.response?.headers, null, 2));
        console.error("Request Config:", JSON.stringify({
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
        }, null, 2));
        console.error("===========================");
        // Return the actual error from Cashfree API if available
        if (error.response?.data?.message) {
            return res.status(error.response.status || 500).json({
                success: false,
                message: error.response.data.message,
                code: error.response.data.code || null
            });
        } else {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

// ======================
// CASHFREE WEBHOOK (FINAL)
// ======================
// ======================
// ENHANCED CASHFREE WEBHOOK ONLY
// ======================

// ======================
// SIMPLIFIED CASHFREE WEBHOOK
// ======================

exports.handleCashfreeWebhook = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");
    const start = Date.now();

    try {
        console.log("🟢 CASHFREE WEBHOOK RECEIVED =====================");
        console.log("📤 Webhook Raw Body:", req.rawBody ? req.rawBody.substring(0, 200) + "..." : "NO RAW BODY");
        console.log("🏷️ Headers:", JSON.stringify(req.headers, null, 2));

        // Get webhook details - using WEBHOOK_SECRET for signature verification
        const signature = req.headers["x-cashfree-signature"];
        const rawBody = req.rawBody; // This comes from index.js raw body middleware
        const secret = cashfreeConfig.WEBHOOK_SECRET;

        console.log("📄 Webhook raw body length:", rawBody?.length || 0);

        // Verify signature
        if (signature && rawBody && secret) {
            const expected = crypto
                .createHmac("sha256", secret)
                .update(rawBody)
                .digest("base64");

            if (expected !== signature) {
                console.error("❌ INVALID SIGNATURE");
                console.log("Expected:", expected);
                console.log("Received:", signature);
                return res.status(400).json({ error: "Invalid signature" });
            } else {
                console.log("✅ Signature verified");
            }
        } else {
            console.log("⚠️ No signature or rawBody - might be test");
            // In development, we might skip verification
            if (process.env.NODE_ENV !== "development") {
                return res.status(400).json({ error: "Missing signature" });
            }
        }

        // Parse webhook data
        const webhookData = JSON.parse(rawBody);
        console.log("📋 Webhook Event:", webhookData.type);

        // Extract order ID
        const orderId = webhookData.data?.order?.order_id;
        if (!orderId) {
            console.warn("❌ No order ID in webhook");
            return res.status(200).json({ received: true });
        }

        console.log("🔍 Order ID:", orderId);

        // Find transaction
        const transaction = await TransactionModel.findOne({ transaction_id: orderId });
        if (!transaction) {
            console.warn("❌ Transaction not found:", orderId);
            return res.status(200).json({ received: true });
        }

        // Check if already processed
        if (transaction.webhook_processed) {
            console.log("⚠️ Already processed:", orderId);
            return res.status(200).json({ received: true });
        }

        // Process based on event type
        if (webhookData.type === "PAYMENT_SUCCESS_WEBHOOK") {
            console.log("💰 Processing successful payment...");

            // Amount verification
            const paymentData = webhookData.data?.payment;
            if (paymentData) {
                const receivedAmount = parseFloat(paymentData.payment_amount);
                const expectedAmount = parseFloat(transaction.credit);

                if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
                    console.error("❌ Amount mismatch!");

                    transaction.status = "Failed";
                    transaction.payment_status = "Failed";
                    transaction.description = `Amount mismatch: ₹${receivedAmount} vs ₹${expectedAmount}`;
                    transaction.webhook_processed = true;
                    transaction.webhook_processed_at = new Date();
                    transaction.payment_failed_at = new Date();
                    await transaction.save();

                    return res.status(200).json({ received: true });
                }
            }

            // Update account balance
            if (transaction.account_number && transaction.account_type) {
                const allAccounts = await AccountsModel.find({});
                const account = allAccounts.find(acc =>
                    (acc.member_id == transaction.member_id) &&
                    (acc.account_no == transaction.account_number) &&
                    (acc.account_type === transaction.account_type) &&
                    (acc.status === "active")
                );

                if (account) {
                    const newBalance = account.account_amount + parseFloat(transaction.credit);
                    account.account_amount = newBalance;
                    await account.save();

                    transaction.balance = newBalance;
                    console.log(`✅ Account ${account.account_no} credited: ₹${transaction.credit}`);
                }
            }

            // Update transaction
            transaction.status = "Completed";
            transaction.payment_status = "Success";
            transaction.payment_completed_at = new Date();
            transaction.webhook_processed = true;
            transaction.webhook_processed_at = new Date();

            // Store payment details
            if (paymentData) {
                transaction.payment_details = {
                    payment_method: typeof paymentData.payment_method === 'string'
                        ? paymentData.payment_method
                        : JSON.stringify(paymentData.payment_method),
                    bank_reference: paymentData.bank_reference,
                    payment_time: paymentData.payment_time,
                    payment_amount: paymentData.payment_amount,
                    gateway_payment_id: paymentData.cf_payment_id
                };
            }

            transaction.payment_data = webhookData.data;
            await transaction.save();

            console.log(`✅ Payment completed in ${Date.now() - start}ms`);

        }
        else if (webhookData.type === "PAYMENT_FAILED_WEBHOOK") {
            console.log("❌ Processing failed payment...");

            transaction.status = "Failed";
            transaction.payment_status = "Failed";
            transaction.payment_failed_at = new Date();
            transaction.webhook_processed = true;
            transaction.webhook_processed_at = new Date();
            transaction.payment_data = webhookData.data;
            await transaction.save();

            console.log(`✅ Failed payment processed in ${Date.now() - start}ms`);
        }
        // For other events, just mark as processed
        else {
            console.log("ℹ️ Other webhook event:", webhookData.type);
            transaction.webhook_processed = true;
            transaction.webhook_processed_at = new Date();
            await transaction.save();
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error("❌ WEBHOOK ERROR:", error.message);
        // Always return 200 to acknowledge
        console.log("✅ Webhook processed successfully");
        return res.status(200).json({ received: true });
    } finally {
        console.log("🔚 WEBHOOK PROCESSING COMPLETED\n");
    }
};

// 3. Status Check (Polling)
exports.checkPaymentStatus = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");

    try {
        const { orderId } = req.params;

        // Direct axios call to Cashfree API
        const response = await axios.get(`${cashfreeConfig.CASHFREE_BASE_URL}/pg/orders/${orderId}/payments`, {
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': cashfreeConfig.CASHFREE_APP_ID,
                'x-client-secret': cashfreeConfig.CASHFREE_SECRET_KEY,
                'x-api-version': cashfreeConfig.X_API_VERSION
            }
        });

        // Logic to sync DB if needed
        const payments = response.data;
        const successPayment = payments.find(p => p.payment_status === "SUCCESS");

        if (successPayment) {
            // Logic similar to webhook to mark success if not already done
            const transaction = await TransactionModel.findOne({ transaction_id: orderId });
            if (transaction && transaction.status !== "Completed") {
                // Mark as completed
                transaction.payment_status = "Success";
                transaction.status = "Completed";
                transaction.description = `Online Top-up to Account ${transaction.account_number} (Success)`;

                // Update account balance
                if (transaction.account_number && transaction.account_type) {
                    // Find the account
                    const allAccounts = await AccountsModel.find({});
                    const account = allAccounts.find(acc =>
                        (acc.member_id === transaction.member_id || acc.member_id === parseInt(transaction.member_id)) &&
                        (acc.account_no == transaction.account_number) &&
                        (acc.account_type === transaction.account_type)
                    );

                    if (account) {
                        // Credit the account balance
                        const newAccountBalance = account.account_amount + transaction.credit;
                        account.account_amount = newAccountBalance;
                        await account.save();

                        // Set transaction balance to the account's new balance
                        transaction.balance = newAccountBalance;

                        console.log(`[Status Check] Account ${account.account_no} credited with ₹${transaction.credit}. New balance: ₹${newAccountBalance}`);
                    } else {
                        console.error(`[Status Check] Account not found for transaction ${orderId}`);
                        transaction.description += " (Warning: Account not found for balance update)";
                    }
                } else {
                    // Fallback for old transactions without account details
                    const lastTx = await TransactionModel.findOne({ member_id: transaction.member_id, status: "Completed" }).sort({ createdAt: -1 });
                    const lastBalance = lastTx ? lastTx.balance : 0;
                    transaction.balance = lastBalance + transaction.credit;
                }

                await transaction.save();
            }
            return res.status(200).json({ success: true, status: "SUCCESS" });
        }

        return res.status(200).json({ success: true, status: "PENDING/FAILED" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// ==========================================
// Money Transfer Between Accounts
// ==========================================

// Transfer money between two accounts
exports.transferMoney = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");
    const MemberModel = require("../../models/member.model");

    try {
        const { from, to, amount } = req.body;

        // Validate input
        if (!from || !to || !amount) {
            return res.status(400).json({
                success: false,
                message: "From account, to account, and amount are required"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Transfer amount must be greater than zero"
            });
        }

        // Validate sender member exists and is active
        const allMembers = await MemberModel.find({});
        const senderMember = allMembers.find(m => m.member_id === from.member_id || m.member_id === parseInt(from.member_id));
        if (!senderMember) {
            return res.status(404).json({
                success: false,
                message: "Sender member not found"
            });
        }

        if (senderMember.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Sender member account is not active"
            });
        }

        // Validate receiver member exists and is active
        const receiverMember = allMembers.find(m => m.member_id === to.member_id || m.member_id === parseInt(to.member_id));
        if (!receiverMember) {
            return res.status(404).json({
                success: false,
                message: "Receiver member not found"
            });
        }

        if (receiverMember.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Receiver member account is not active"
            });
        }

        // Find sender account (handle type mismatches)
        const allAccounts = await AccountsModel.find({});
        const senderAccount = allAccounts.find(acc =>
            (acc.account_id === from.account_id || acc.account_id === parseInt(from.account_id)) &&
            (acc.member_id === from.member_id || acc.member_id === parseInt(from.member_id)) &&
            (acc.account_no == from.account_no) &&
            (acc.account_type === from.account_type)
        );

        if (!senderAccount) {
            return res.status(404).json({
                success: false,
                message: "Sender account not found"
            });
        }

        // Check if sender account is active
        if (senderAccount.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Sender account is not active"
            });
        }

        // Find receiver account (handle type mismatches)
        const receiverAccount = allAccounts.find(acc =>
            (acc.account_id === to.account_id || acc.account_id === parseInt(to.account_id)) &&
            (acc.member_id === to.member_id || acc.member_id === parseInt(to.member_id)) &&
            (acc.account_no == to.account_no) &&
            (acc.account_type === to.account_type)
        );

        if (!receiverAccount) {
            return res.status(404).json({
                success: false,
                message: "Receiver account not found"
            });
        }

        // Check if receiver account is active
        if (receiverAccount.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Receiver account is not active"
            });
        }

        // Check if sender has sufficient balance
        if (senderAccount.account_amount < amount) {
            // Record failed transaction
            const failedTxId = generateTransactionId();
            await TransactionModel.create({
                transaction_id: failedTxId,
                transaction_date: new Date(),
                member_id: from.member_id,
                account_number: from.account_no,
                account_type: from.account_type,
                transaction_type: "Transfer",
                description: `Failed transfer to ${receiverMember.name} (${to.account_no}) - Insufficient balance`,
                debit: amount,
                credit: 0,
                balance: senderAccount.account_amount,
                Name: senderMember.name,
                mobileno: senderMember.contactno,
                status: "Failed"
            });

            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available: ₹${senderAccount.account_amount}, Required: ₹${amount}`
            });
        }

        // Perform the transfer
        // Deduct from sender
        senderAccount.account_amount -= amount;
        await senderAccount.save();

        // Add to receiver
        receiverAccount.account_amount += amount;
        await receiverAccount.save();

        // Create debit transaction for sender
        const debitTxId = generateTransactionId();
        const debitTransaction = await TransactionModel.create({
            transaction_id: debitTxId,
            transaction_date: new Date(),
            member_id: from.member_id,
            account_number: from.account_no,
            account_type: from.account_type,
            transaction_type: "Transfer",
            description: `Transfer to ${receiverMember.name} (${to.account_no})`,
            debit: amount,
            credit: 0,
            balance: senderAccount.account_amount,
            Name: senderMember.name,
            mobileno: senderMember.contactno,
            status: "Completed"
        });

        // Create credit transaction for receiver
        await TransactionModel.create({
            transaction_id: generateTransactionId(),
            transaction_date: new Date(),
            member_id: to.member_id,
            account_number: to.account_no,
            account_type: to.account_type,
            transaction_type: "Transfer",
            description: `Transfer from ${senderMember.name} (${from.account_no})`,
            credit: amount,
            debit: 0,
            balance: receiverAccount.account_amount,
            Name: receiverMember.name,
            mobileno: receiverMember.contactno,
            status: "Completed",
            reference_no: debitTxId
        });

        return res.status(200).json({
            success: true,
            message: "Money transferred successfully",
            data: {
                transactionId: debitTxId,
                from: {
                    account_no: from.account_no,
                    member_name: senderMember.name,
                    new_balance: senderAccount.account_amount
                },
                to: {
                    account_no: to.account_no,
                    member_name: receiverMember.name,
                    new_balance: receiverAccount.account_amount
                },
                amount: amount,
                transfer_date: new Date()
            }
        });

    } catch (error) {
        console.error("Error in money transfer:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to transfer money",
            error: error.message
        });
    }
};

// ==========================================
// Withdraw Request
// ==========================================

// Request money withdrawal
exports.requestWithdraw = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");
    const MemberModel = require("../../models/member.model");
    const WithdrawRequestModel = require("../../models/withdrawRequest.model");

    try {
        const {
            member_id,
            account_id,
            account_no,
            account_type,
            amount,
            bank_account_number,
            ifsc_code,
            account_holder_name
        } = req.body;

        // Validate input
        if (!member_id || !account_id || !account_no || !account_type || !amount) {
            return res.status(400).json({
                success: false,
                message: "Member ID, account details, and amount are required"
            });
        }

        if (!bank_account_number || !ifsc_code || !account_holder_name) {
            return res.status(400).json({
                success: false,
                message: "Bank account details (account number, IFSC code, account holder name) are required"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Withdrawal amount must be greater than zero"
            });
        }

        // Validate member exists and is active
        const allMembers = await MemberModel.find({});
        const member = allMembers.find(m => m.member_id === member_id || m.member_id === parseInt(member_id));

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        if (member.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Member account is not active. Cannot process withdrawal request."
            });
        }

        // Find and validate account
        const allAccounts = await AccountsModel.find({});
        const account = allAccounts.find(acc =>
            (acc.account_id === account_id || acc.account_id === parseInt(account_id)) &&
            (acc.member_id === member_id || acc.member_id === parseInt(member_id)) &&
            (acc.account_no == account_no) &&
            (acc.account_type === account_type)
        );

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found or does not belong to this member"
            });
        }

        // Check if account is active
        if (account.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Account is not active. Cannot process withdrawal request."
            });
        }

        // Check if account has sufficient balance
        if (account.account_amount < amount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Available: ₹${account.account_amount}, Required: ₹${amount}`
            });
        }

        // Generate unique withdraw request ID
        const withdrawRequestId = `WR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create withdraw request
        const withdrawRequest = new WithdrawRequestModel({
            withdraw_request_id: withdrawRequestId,
            member_id: member_id,
            account_id: account_id,
            account_no: account_no,
            account_type: account_type,
            amount: amount,
            bank_account_number: bank_account_number,
            ifsc_code: ifsc_code.toUpperCase(),
            account_holder_name: account_holder_name,
            status: "Pending",
            requested_date: new Date()
        });

        await withdrawRequest.save();

        return res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully. It will be processed within 2-3 business days.",
            data: {
                withdraw_request_id: withdrawRequestId,
                member_name: member.name,
                account_no: account_no,
                account_type: account_type,
                amount: amount,
                bank_account_number: bank_account_number,
                ifsc_code: ifsc_code.toUpperCase(),
                account_holder_name: account_holder_name,
                status: "Pending",
                requested_date: withdrawRequest.requested_date
            }
        });

    } catch (error) {
        console.error("Error in withdraw request:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process withdrawal request",
            error: error.message
        });
    }
};

// Manual Webhook Trigger (For Testing)
exports.triggerTestWebhook = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ 
                success: false, 
                message: "Order ID is required" 
            });
        }

        // Find the transaction
        const transaction = await TransactionModel.findOne({ 
            transaction_id: orderId 
        });

        if (!transaction) {
            return res.status(404).json({ 
                success: false, 
                message: "Transaction not found" 
            });
        }

        // Create mock webhook data
        const mockWebhookData = {
            type: status === 'SUCCESS' ? 'PAYMENT_SUCCESS_WEBHOOK' : 'PAYMENT_FAILED_WEBHOOK',
            data: {
                order: {
                    order_id: orderId,
                    order_amount: transaction.credit.toString(),
                    order_currency: "INR"
                },
                payment: {
                    cf_payment_id: `mock_payment_${Date.now()}`,
                    payment_status: status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
                    payment_amount: transaction.credit.toString(),
                    payment_currency: "INR",
                    payment_time: new Date().toISOString(),
                    payment_method: "TEST",
                    bank_reference: `mock_ref_${Date.now()}`
                }
            }
        };

        // Call your webhook handler directly
        const mockReq = {
            headers: {
                'x-cashfree-signature': 'test_signature_for_development'
            },
            rawBody: JSON.stringify(mockWebhookData)
        };

        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    console.log(`Mock webhook response: ${code}`, data);
                    return data;
                }
            })
        };

        // Trigger the webhook handler
        await exports.handleCashfreeWebhook(mockReq, mockRes);

        return res.status(200).json({
            success: true,
            message: `Test webhook triggered for order ${orderId} with status ${status}`,
            transaction_id: orderId
        });

    } catch (error) {
        console.error("Test webhook error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Test Payment Status Update
exports.testPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Find transaction
        const transaction = await TransactionModel.findOne({ 
            transaction_id: orderId 
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        // Update to success for testing
        transaction.status = "Completed";
        transaction.payment_status = "Success";
        transaction.payment_completed_at = new Date();
        transaction.description = `Online Top-up to Account ${transaction.account_number} (Success - Test)`;
        
        await transaction.save();

        return res.status(200).json({
            success: true,
            message: "Payment marked as success for testing",
            data: transaction
        });

    } catch (error) {
        console.error("Test payment error:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
