const TransactionModel = require("../../models/transaction.model");
const razorpayConfig = require("../../utils/razorpay");
const crypto = require("crypto");
const axios = require("axios");
const { processTransactionCommission } = require("../../utils/commissionUtils");
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
// Razorpay Payment Integration
// ==========================================


// 1. Create Payment Order (Using Razorpay Orders API)
exports.createPaymentOrder = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");
    const MemberModel = require("../../models/member.model");

    try {
        const { member_id, amount, mobileno, Name, email, account_id, account_no, account_type, description } = req.body;

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

        const orderId = `ORDER_${Date.now()}`; // Generate unique Order ID

        // Check if Razorpay credentials are available
        if (!razorpayConfig.razorpay) {
            console.error("❌ Razorpay credentials not configured");
            return res.status(500).json({
                success: false,
                message: "Payment gateway not configured. Contact administrator."
            });
        }

        // Prepare Request for Razorpay Orders API
        const options = {
            amount: Math.round(Number(amount) * 100), // amount in the smallest currency unit (paise)
            currency: "INR",
            receipt: orderId,
            notes: {
                account_no: String(account_no),
                account_type: account_type,
                member_id: String(member_id),
                description: description || "Add Money"
            }
        };

        console.log("=== Creating Razorpay Order ===");
        console.log("Environment:", razorpayConfig.IS_PRODUCTION ? "PRODUCTION" : "SANDBOX");
        console.log("Options:", JSON.stringify(options, null, 2));

        const order = await razorpayConfig.razorpay.orders.create(options);

        console.log("=== Razorpay Response ===");
        console.log("Order Data:", JSON.stringify(order, null, 2));

        // Create Pending Transaction in DB with account details
        const newTx = new TransactionModel({
            transaction_id: orderId, // Use our generated receipt Order ID as Transaction ID
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
            payment_gateway: "Razorpay",
            gateway_order_id: order.id,
            payment_session_id: order.id, // For backward compatibility with existing DB schema
            payment_status: "Pending",
            Name,
            mobileno
        });

        await newTx.save();

        return res.status(200).json({
            success: true,
            order_id: orderId,
            razorpay_order_id: order.id,
            key_id: razorpayConfig.RAZORPAY_KEY_ID,
            account_no: account_no
        });

    } catch (error) {
        console.error("=== Razorpay Order Error ===");
        console.error("Error Message:", error.message);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create payment order"
        });
    }
};

// ======================
// RAZORPAY WEBHOOK (FINAL)
// ======================

exports.handleRazorpayWebhook = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");
    const start = Date.now();

    try {
        console.log("🟢 RAZORPAY WEBHOOK RECEIVED =====================");
        console.log("📍 Path:", req.originalUrl);
        console.log("📦 Webhook Method:", req.method);

        // Handle raw body - ensure we have the exact string
        let rawBody;
        if (req.rawBody) {
            rawBody = req.rawBody;
        } else if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
        } else if (typeof req.body === 'string') {
            rawBody = req.body;
        } else {
            rawBody = JSON.stringify(req.body);
        }

        const signature = req.headers["x-razorpay-signature"];
        const secret = razorpayConfig.RAZORPAY_WEBHOOK_SECRET;

        // -------------------------
        // 🔐 SIGNATURE VERIFICATION
        // -------------------------
        if (signature && secret && rawBody) {
            const expectedSignature = crypto
                .createHmac("sha256", secret)
                .update(rawBody)
                .digest("hex");

            if (expectedSignature !== signature) {
                console.warn("⚠️ Razorpay signature mismatch");
            } else {
                console.log("✅ Signature verified successfully");
            }
        }

        // -------------------------
        // 📦 PARSE WEBHOOK PAYLOAD
        // -------------------------
        let webhookData;
        try {
            webhookData = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch (parseErr) {
            console.error("❌ Failed to parse webhook body:", parseErr);
            return res.status(200).json({ received: true, error: "Invalid JSON" });
        }

        const eventType = webhookData.event;
        const payloadEntity = eventType.startsWith('payment') 
                              ? webhookData?.payload?.payment?.entity 
                              : webhookData?.payload?.order?.entity;
        
        const razorpayOrderId = eventType.startsWith('payment') 
                                ? payloadEntity?.order_id 
                                : payloadEntity?.id;

        if (!razorpayOrderId) {
            console.warn("⚠️ No order_id found in webhook data");
            return res.status(200).json({ received: true });
        }

        console.log("📋 Event:", eventType);
        console.log("🔍 Razorpay Order ID:", razorpayOrderId);

        // -------------------------
        // 🔁 DUPLICATE PROTECTION
        // -------------------------
        const transaction = await TransactionModel.findOneAndUpdate(
            {
                gateway_order_id: razorpayOrderId,
                webhook_processed: { $ne: true }
            },
            {
                $set: {
                    webhook_processed: true,
                    webhook_processed_at: new Date()
                }
            },
            { new: true }
        );

        if (!transaction) {
            console.log("⚠️ Duplicate or missing transaction:", razorpayOrderId);
            return res.status(200).json({ received: true });
        }

        // -------------------------
        // ✅ PAYMENT SUCCESS
        // -------------------------
        if (eventType === "order.paid" || eventType === "payment.captured") {
            if (transaction.status === "Completed") {
                return res.status(200).json({ received: true, message: "Already processed" });
            }

            console.log("💰 Processing successful payment");

            // Amount is in paise, so divide by 100
            const receivedAmount = payloadEntity.amount / 100;
            const expectedAmount = parseFloat(transaction.credit);

            if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
                console.error("❌ Amount mismatch");
                transaction.status = "Failed";
                transaction.payment_status = "Failed";
                transaction.description = `Amount mismatch: received ₹${receivedAmount}, expected ₹${expectedAmount}`;
                await transaction.save();
                return res.status(200).json({ received: true });
            }

            // Update account balance
            const account = await AccountsModel.findOne({
                member_id: transaction.member_id,
                account_no: transaction.account_number,
                account_type: transaction.account_type,
                status: "active"
            });

            if (account) {
                account.account_amount += transaction.credit;
                await account.save();
                transaction.balance = account.account_amount;
                console.log("✅ Account balance updated:", account.account_amount);
            }

            transaction.status = "Completed";
            transaction.payment_status = "Success";
            transaction.payment_completed_at = new Date();
            transaction.payment_data = webhookData;
            transaction.description = `Online Top-up to Account ${transaction.account_number} (Success)`;

            await transaction.save();

            // Process commission for introducers
            try {
                await processTransactionCommission(transaction);
            } catch (error) {}
        }
        // -------------------------
        // ❌ PAYMENT FAILED
        // -------------------------
        else if (eventType === "payment.failed") {
            transaction.status = "Failed";
            transaction.payment_status = "Failed";
            transaction.payment_failed_at = new Date();
            transaction.payment_data = webhookData;
            await transaction.save();
        }

        return res.status(200).json({
            success: true,
            received: true,
            status: transaction?.payment_status || "processed"
        });

    } catch (error) {
        console.error("❌ WEBHOOK ERROR:", error.message);
        return res.status(200).json({ received: true, error: error.message });
    }
};


// 3. Status Check (Polling)
exports.checkPaymentStatus = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");

    try {
        const { orderId } = req.params;

        if (!razorpayConfig.razorpay) {
            console.error("❌ Razorpay credentials not configured");
            return res.status(500).json({
                success: false,
                message: "Payment gateway not configured. Cannot check payment status."
            });
        }

        const transaction = await TransactionModel.findOne({ 
            $or: [ { transaction_id: orderId }, { gateway_order_id: orderId }, { payment_session_id: orderId } ]
        });

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        const razorpayOrderId = transaction.gateway_order_id;
        
        if (!razorpayOrderId) {
             return res.status(400).json({ success: false, message: "Missing Razorpay order ID for this transaction" });
        }

        const order = await razorpayConfig.razorpay.orders.fetch(razorpayOrderId);
        
        if (order && order.status === "paid") {
            if (transaction.status !== "Completed") {
                transaction.payment_status = "Success";
                transaction.status = "Completed";
                transaction.description = `Online Top-up to Account ${transaction.account_number} (Success)`;

                if (transaction.account_number && transaction.account_type) {
                    const allAccounts = await AccountsModel.find({});
                    const account = allAccounts.find(acc =>
                        (acc.member_id === transaction.member_id || acc.member_id === parseInt(transaction.member_id)) &&
                        (acc.account_no == transaction.account_number) &&
                        (acc.account_type === transaction.account_type)
                    );

                    if (account) {
                        const newAccountBalance = account.account_amount + transaction.credit;
                        account.account_amount = newAccountBalance;
                        await account.save();
                        transaction.balance = newAccountBalance;
                    }
                } else {
                    const lastTx = await TransactionModel.findOne({ member_id: transaction.member_id, status: "Completed" }).sort({ createdAt: -1 });
                    const lastBalance = lastTx ? lastTx.balance : 0;
                    transaction.balance = lastBalance + transaction.credit;
                }

                await transaction.save();
            }
            return res.status(200).json({ success: true, status: "PAID" });
        }

        return res.status(200).json({ success: true, status: order.status.toUpperCase() });

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

// Request money withdrawal with instant processing (if KYC beneficiary exists)
exports.requestWithdraw = async (req, res) => {
    const AccountsModel = require("../../models/accounts.model");
    const MemberModel = require("../../models/member.model");
    const WithdrawRequestModel = require("../../models/withdrawRequest.model");
    const TransactionModel = require("../../models/transaction.model");
    const generateTransactionId = require("../../utils/generateTransactionId");
    const axios = require("axios");

    let account; // Declare at function scope for error handling
    let originalBalance; // For rollback if needed

    try {
        const {
            member_id,
            account_id,
            account_no,
            account_type,
            amount
        } = req.body;

        // Validate input
        if (!member_id || !account_id || !account_no || !account_type || !amount) {
            return res.status(400).json({
                success: false,
                message: "Member ID, account details, and amount are required"
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

        // Check KYC Status
        if (member.kycStatus !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: "KYC verification required. Please complete KYC before requesting withdrawal.",
                kycStatus: member.kycStatus
            });
        }

        // Check Beneficiary Status
        if (member.beneficiaryStatus !== "CREATED" || !member.beneficiaryId) {
            return res.status(403).json({
                success: false,
                message: "Beneficiary not created. Please contact support or resubmit KYC.",
                beneficiaryStatus: member.beneficiaryStatus
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

        console.log("💸 Processing instant withdrawal...");
        console.log(`   Member: ${member.name} (${member.member_id})`);
        console.log(`   Beneficiary ID: ${member.beneficiaryId}`);
        console.log(`   Amount: ₹${amount}`);

        // Generate unique IDs
        const withdrawRequestId = `WR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const transferId = `TRANSFER_${Date.now()}`;

        // Check if Razorpay credentials are available
        if (!razorpayConfig.RAZORPAY_KEY_ID || !razorpayConfig.RAZORPAY_KEY_SECRET) {
            console.error("❌ Razorpay payout credentials not configured");
            return res.status(500).json({
                success: false,
                message: "Payout gateway not configured. Contact administrator."
            });
        }

        console.log("🔐 RazorpayX Payout Auth");
        console.log(`   Key ID: ${razorpayConfig.RAZORPAY_KEY_ID}`);
        
        const auth = {
            username: razorpayConfig.RAZORPAY_KEY_ID,
            password: razorpayConfig.RAZORPAY_KEY_SECRET,
        };

        // 1. Ensure Contact & Fund Account exist
        let fundAccountId = member.razorpay_fund_account_id;
        
        if (!fundAccountId) {
            console.log("⚠️ Razorpay Fund Account missing, creating inline...");
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

        // 2. Initiate payout transfer using RazorpayX
        console.log("💰 Initiating RazorpayX payout transfer...");

        const transferPayload = {
            account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER || "2323230000000000", // Default test account
            fund_account_id: fundAccountId,
            amount: Math.round(amount * 100), // convert to paise
            currency: "INR",
            mode: "NEFT",
            purpose: "payout",
            queue_if_low_balance: true,
            reference_id: transferId,
            narration: `Withdrawal for account ${account_no}`
        };

        console.log(`   Payload:`, JSON.stringify(transferPayload, null, 2));

        const transferResponse = await axios.post(
            `https://api.razorpay.com/v1/payouts`,
            transferPayload,
            { auth, headers: { "Content-Type": "application/json" } }
        );

        console.log(`✅ Payout response:`, transferResponse.data);

        // Check if payout was successful or processing
        if (transferResponse.data.status === "rejected" || transferResponse.data.status === "failed") {
            console.error("❌ Razorpay payout failed:", transferResponse.data.status_details?.description || "Rejected");
            return res.status(400).json({
                success: false,
                message: `Payout failed: ${transferResponse.data.status_details?.description || "Rejected"}`,
                error: transferResponse.data
            });
        }

        // Deduct balance from account (ONLY after payout succeeds)
        const originalBalance = account.account_amount;
        account.account_amount -= amount;
        await account.save();
        console.log(`✅ Balance deducted: ₹${amount}. New balance: ₹${account.account_amount}`);

        // Generate transaction ID (MUST await!)
        const transactionId = await generateTransactionId();

        // Create debit transaction
        const transaction = await TransactionModel.create({
            transaction_id: transactionId,
            member_id: member_id,
            account_number: account_no,
            account_type: account_type,
            transaction_type: "Withdrawal",
            description: `Withdrawal to ${member.bank_name || 'bank'} (${member.account_number?.slice(-4) || 'XXXX'})`,
            debit: amount,
            credit: 0,
            balance: account.account_amount,
            status: "Completed",
            reference_no: withdrawRequestId,
            Name: member.name,
            mobileno: member.contactno
        });
        console.log(`✅ Transaction created: ${transaction.transaction_id}`);

        // Save withdrawal request with payout details
        const withdrawRequest = await WithdrawRequestModel.create({
            withdraw_request_id: withdrawRequestId,
            member_id: member_id,
            account_id: account_id,
            account_no: account_no,
            account_type: account_type,
            amount: amount,
            bank_account_number: member.account_number,
            ifsc_code: member.ifsc_code,
            account_holder_name: member.name,
            status: "Completed",  // Instantly completed
            requested_date: new Date(),
            processed_date: new Date(),
            processed_by: "SYSTEM_AUTO",
            transaction_id: transaction.transaction_id,
            razorpay_contact_id: member.razorpay_contact_id,
            razorpay_payout_id: transferResponse.data.id,
            razorpay_payout_status: transferResponse.data?.status || "processing"
        });

        console.log(`✅ Withdrawal completed: ${withdrawRequestId}`);

        return res.status(200).json({
            success: true,
            message: "Withdrawal processed successfully. Amount will be credited to your bank account within 1-2 business days.",
            data: {
                withdraw_request_id: withdrawRequestId,
                transfer_id: transferId,
                amount: amount,
                bank_account: `****${member.account_number?.slice(-4) || 'XXXX'}`,
                bank_name: member.bank_name,
                ifsc_code: member.ifsc_code,
                status: "Completed",
                new_balance: account.account_amount,
                processed_date: new Date()
            }
        });

    } catch (error) {
        console.error("❌ Withdrawal error:", error.response?.data || error.message);
        console.error("Error stack:", error.stack);

        // CRITICAL: If error occurred after balance deduction, rollback!
        // This prevents user losing money if transaction creation fails
        try {
            if (account && account.account_amount !== undefined) {
                // Check if balance was modified
                const currentBalance = account.account_amount;
                // Reload account to check if it was saved
                const freshAccount = await AccountsModel.findOne({ account_no: account_no });
                if (freshAccount && freshAccount.account_amount !== originalBalance) {
                    // Balance was deducted, rollback!
                    console.log("⚠️ Rolling back balance deduction...");
                    freshAccount.account_amount += amount;
                    await freshAccount.save();
                    console.log(`✅ Balance rolled back to: ₹${freshAccount.account_amount}`);
                }
            }
        } catch (rollbackError) {
            console.error("❌ Rollback failed:", rollbackError.message);
        }

        const errorMessage = error.response?.data?.message || error.message || "Unknown error occurred";

        return res.status(500).json({
            success: false,
            message: "Failed to process withdrawal. Please try again or contact support.",
            error: errorMessage
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
