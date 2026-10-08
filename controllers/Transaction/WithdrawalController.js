const WithdrawRequestModel = require("../../models/withdrawRequest.model");
const CommissionModel = require("../../models/commission.model");
const TransactionModel = require("../../models/transaction.model");
const MemberModel = require("../../models/member.model");
const AgentModel = require("../../models/agent.model");
const mongoose = require("mongoose");

// Helper to calculate available commission balance for member or agent
const calculateAvailableBalance = async (userId) => {
    let userDoc = await MemberModel.findOne({ member_id: userId }).lean();
    let userType = "MEMBER";
    if (!userDoc) {
        userDoc = await AgentModel.findOne({ agent_id: userId }).lean();
        if (userDoc) userType = "AGENT";
    }

    // 1. Commission credits (EARNED)
    const commissions = await CommissionModel.find({ beneficiary_id: userId }).lean();
    const totalEarned = commissions
        .filter(c => c.status === 'CREDITED')
        .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

    // 2. Withdrawal requests
    const withdrawals = await WithdrawRequestModel.find({
        member_id: userId,
        source_type: 'Commission'
    }).lean();

    const totalCompletedWithdrawals = withdrawals
        .filter(w => w.status === 'Completed' || w.status === 'Approved')
        .reduce((sum, w) => sum + (w.amount || 0), 0);

    const withdrawTxIds = new Set(
        withdrawals
            .map(w => w.transaction_id || w.withdraw_request_id)
            .filter(Boolean)
    );

    const standaloneWithdrawn = commissions
        .filter(c => (c.status === 'WITHDRAWN' || c.account_type === 'WITHDRAWAL') && !withdrawTxIds.has(c.transaction_id))
        .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

    const totalWithdrawn = totalCompletedWithdrawals + standaloneWithdrawn;

    const totalPendingWithdrawals = withdrawals
        .filter(w => w.status === 'Pending')
        .reduce((sum, w) => sum + (w.amount || 0), 0);

    const availableBalance = Math.max(0, totalEarned - totalWithdrawn - totalPendingWithdrawals);

    // Synchronize agent's commission_balance in DB if agent so DB stays consistent
    if (userType === "AGENT") {
        await AgentModel.updateOne(
            { agent_id: userId },
            { $set: { commission_balance: availableBalance } }
        );
    }

    return availableBalance;
};

// User / Agent: Request Commission Withdrawal
exports.withdrawCommission = async (req, res) => {
    try {
        const { member_id, agent_id, amount, bank_account_number, ifsc_code, account_holder_name, bank_name, is_agent } = req.body;
        const targetId = member_id || agent_id;

        if (!targetId || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid request data. Please enter a valid amount." });
        }

        // Find user in MemberModel or AgentModel
        let userDoc = await MemberModel.findOne({ member_id: targetId }).lean();
        let userType = "MEMBER";
        if (!userDoc) {
            userDoc = await AgentModel.findOne({ agent_id: targetId }).lean();
            if (userDoc) userType = "AGENT";
        }
        if (String(targetId).startsWith("AG") || is_agent) {
            userType = "AGENT";
        }

        const reqAmount = parseFloat(amount);
        let deductionRate = 0;
        let deductionAmount = 0;
        let netAmount = reqAmount;

        // 10% deduction logic for Agent commission withdrawal
        if (userType === "AGENT") {
            deductionRate = 10;
            deductionAmount = Math.round((reqAmount * 0.10) * 100) / 100;
            netAmount = Math.round((reqAmount - deductionAmount) * 100) / 100;
        }

        const availableBalance = await calculateAvailableBalance(targetId);

        if (availableBalance < reqAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient commission balance. Available: ₹${availableBalance.toFixed(2)}`
            });
        }

        // Create Request (bank details optional - default to user profile or 'N/A')
        const newRequest = new WithdrawRequestModel({
            withdraw_request_id: `WREQ${Date.now()}`,
            member_id: targetId,
            source_type: 'Commission',
            amount: reqAmount,
            deduction_rate: deductionRate,
            deduction_amount: deductionAmount,
            net_amount: netAmount,
            bank_account_number: bank_account_number || userDoc?.account_number || 'N/A',
            ifsc_code: ifsc_code || userDoc?.ifsc_code || 'N/A',
            account_holder_name: account_holder_name || userDoc?.account_holder_name || userDoc?.name || (userType === 'AGENT' ? 'Agent' : 'Member'),
            bank_name: bank_name || userDoc?.bank_name || 'N/A',
            user_type: userType,
            status: 'Pending'
        });

        await newRequest.save();

        res.status(200).json({
            success: true,
            message: userType === 'AGENT'
                ? `Withdrawal request for ₹${reqAmount.toFixed(2)} (10% deduction: ₹${deductionAmount.toFixed(2)}, Net payable: ₹${netAmount.toFixed(2)}) submitted successfully`
                : "Withdrawal request submitted successfully to admin",
            data: newRequest
        });

    } catch (error) {
        console.error("Error asking withdrawal:", error);
        res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
    }
};

// Admin: Get Requests
exports.getWithdrawalRequests = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status && status !== 'All') {
            query.status = status;
        }

        // Get withdrawal requests
        const requests = await WithdrawRequestModel.find(query).sort({ createdAt: -1 }).lean();

        const enrichedRequests = await Promise.all(
            requests.map(async (request) => {
                let user = await MemberModel.findOne({ member_id: request.member_id }).lean();
                let userType = request.user_type || "MEMBER";
                if (!user) {
                    user = await AgentModel.findOne({ agent_id: request.member_id }).lean();
                    if (user) userType = "AGENT";
                }
                if (String(request.member_id || '').startsWith('AG')) {
                    userType = "AGENT";
                }

                const currentBalance = await calculateAvailableBalance(request.member_id);

                const isAgent = userType === "AGENT";
                const deductionRate = (request.deduction_rate !== undefined && request.deduction_rate !== null)
                    ? request.deduction_rate
                    : (isAgent ? 10 : 0);
                const deductionAmount = (request.deduction_amount !== undefined && request.deduction_amount !== null)
                    ? request.deduction_amount
                    : Math.round(((request.amount || 0) * (deductionRate / 100)) * 100) / 100;
                const netAmount = (request.net_amount !== undefined && request.net_amount !== null && request.net_amount > 0)
                    ? request.net_amount
                    : Math.round(((request.amount || 0) - deductionAmount) * 100) / 100;

                return {
                    ...request,
                    user_type: userType,
                    deduction_rate: deductionRate,
                    deduction_amount: deductionAmount,
                    net_amount: netAmount,
                    balance: currentBalance,
                    member_details: {
                        name: user ? user.name : (request.account_holder_name || 'N/A'),
                        contactno: user ? (user.contactno || user.mobile) : 'N/A',
                        bank_name: (user && user.bank_name) || (request.bank_name !== 'N/A' ? request.bank_name : '') || 'Not Provided',
                        account_number: (user && user.account_number) || (request.bank_account_number !== 'N/A' ? request.bank_account_number : '') || 'Not Provided',
                        ifsc_code: (user && user.ifsc_code) || (request.ifsc_code !== 'N/A' ? request.ifsc_code : '') || 'Not Provided',
                        account_holder_name: (user && (user.account_holder_name || user.name)) || (request.account_holder_name !== 'N/A' ? request.account_holder_name : '') || 'Not Provided',
                        user_type: userType,
                        balance: currentBalance
                    }
                };
            })
        );

        res.status(200).json({ success: true, data: enrichedRequests });

    } catch (error) {
        console.error("getWithdrawalRequests error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Pay/Approve Withdrawal
exports.approveWithdrawal = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { request_id, action, transaction_id, remarks } = req.body;
        // action: 'Pay' (Approve & Pay) or 'Reject'

        const request = await WithdrawRequestModel.findOne({ withdraw_request_id: request_id }).session(session);
        if (!request) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        if (request.status !== 'Pending') {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Request is already processed" });
        }

        if (action === 'Reject') {
            request.status = 'Rejected';
            request.rejection_reason = remarks;
            request.processed_date = new Date();
            await request.save({ session });
            await session.commitTransaction();
            return res.status(200).json({ success: true, message: "Request rejected" });
        }

        if (action === 'Pay') {
            let user = await MemberModel.findOne({ member_id: request.member_id }).session(session);
            let userType = request.user_type || "MEMBER";
            if (!user) {
                user = await AgentModel.findOne({ agent_id: request.member_id }).session(session);
                if (user) userType = "AGENT";
            }
            if (String(request.member_id || '').startsWith('AG')) {
                userType = "AGENT";
            }

            const isAgent = userType === "AGENT";
            const deductionRate = (request.deduction_rate !== undefined && request.deduction_rate !== null)
                ? request.deduction_rate
                : (isAgent ? 10 : 0);
            const deductionAmount = (request.deduction_amount !== undefined && request.deduction_amount !== null)
                ? request.deduction_amount
                : Math.round(((request.amount || 0) * (deductionRate / 100)) * 100) / 100;
            const netAmount = (request.net_amount !== undefined && request.net_amount !== null && request.net_amount > 0)
                ? request.net_amount
                : Math.round(((request.amount || 0) - deductionAmount) * 100) / 100;

            // If it's an Agent, deduct commission_balance in AgentModel as well
            if (userType === "AGENT" && user) {
                user.commission_balance = Math.max(0, (user.commission_balance || 0) - request.amount);
                await user.save({ session });
            }

            if (request.source_type === 'Commission') {
                const noteText = isAgent
                    ? `${remarks ? remarks + " | " : ""}Commission withdrawal approved (Gross: ₹${request.amount}, 10% Deduction: ₹${deductionAmount}, Net Paid: ₹${netAmount})`
                    : (remarks || "Commission withdrawal approved by admin");

                // 1. Create WITHDRAWN record in CommissionModel
                const newCommission = new CommissionModel({
                    commission_id: `COMM-WD-${Date.now()}`,
                    beneficiary_id: request.member_id,
                    beneficiary_name: user ? user.name : (request.account_holder_name || "Beneficiary"),
                    beneficiary_type: userType,
                    source_id: request.member_id,
                    source_name: user ? user.name : (request.account_holder_name || "Beneficiary"),
                    source_type: userType,
                    transaction_id: transaction_id || `WD-${Date.now()}`,
                    transaction_date: new Date(),
                    account_type: "WITHDRAWAL",
                    transaction_amount: request.amount,
                    commission_rate: 0,
                    commission_amount: request.amount,
                    level: 0,
                    status: "WITHDRAWN",
                    credited_at: new Date(),
                    notes: noteText
                });
                await newCommission.save({ session });

                // 2. Add Global Transaction Entry (For Transaction History Table)
                const newTransaction = new TransactionModel({
                    transaction_id: transaction_id || `TRX_W_${Date.now()}`,
                    transaction_date: new Date(),
                    member_id: request.member_id,
                    account_number: request.bank_account_number || (user && user.account_number) || 'N/A',
                    account_type: 'Commission',
                    transaction_type: 'Withdrawal',
                    description: isAgent
                        ? `Commission Withdrawal Approved (10% Deduction: ₹${deductionAmount}, Net Paid: ₹${netAmount})`
                        : `Commission Withdrawal Approved`,
                    credit: 0,
                    debit: request.amount,
                    ew_debit: "0",
                    balance: 0,
                    Name: user ? user.name : (request.account_holder_name || "Unknown"),
                    mobileno: user ? (user.contactno || user.mobile) : "N/A",
                    status: "Completed",
                    reference_no: transaction_id || 'N/A',
                    collected_by: "ADMIN",
                    paid_by: "ADMIN"
                });
                await newTransaction.save({ session });
            }

            request.status = 'Completed';
            request.transaction_id = transaction_id;
            request.deduction_rate = deductionRate;
            request.deduction_amount = deductionAmount;
            request.net_amount = netAmount;
            request.processed_date = new Date();
            await request.save({ session });
        }

        await session.commitTransaction();
        res.status(200).json({ success: true, message: "Withdrawal processed successfully" });

    } catch (error) {
        await session.abortTransaction();
        console.error("Approve Withdraw Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Error: " + (error.message || "Unknown error"),
            details: error.errors
        });
    } finally {
        session.endSession();
    }
};
