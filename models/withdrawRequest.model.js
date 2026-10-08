const mongoose = require("mongoose");

const withdrawRequestSchema = mongoose.Schema(
    {
        withdraw_request_id: {
            type: String,
            required: true,
            unique: true,
        },
        member_id: {
            type: String,
            required: true,
            index: true,
        },
        // Source type: 'Account' or 'Commission'
        source_type: {
            type: String,
            enum: ["Account", "Commission"],
            default: "Account",
            required: true
        },
        // Optional for Commission withdrawals
        account_id: {
            type: String,
            default: null
        },
        account_no: {
            type: String,
            default: null
        },
        account_type: {
            type: String,
            default: null
        },
        // Amount to withdraw
        amount: {
            type: Number,
            required: true,
        },
        // Deduction details (e.g., 10% for Agent withdrawals)
        deduction_rate: {
            type: Number,
            default: 0,
        },
        deduction_amount: {
            type: Number,
            default: 0,
        },
        net_amount: {
            type: Number,
            default: 0,
        },
        // Bank Details
        bank_account_number: {
            type: String,
            default: 'N/A',
        },
        ifsc_code: {
            type: String,
            default: 'N/A',
        },
        account_holder_name: {
            type: String,
            default: 'N/A',
        },
        bank_name: {
            type: String,
            default: 'N/A',
        },
        user_type: {
            type: String,
            default: 'MEMBER',
        },
        // Status
        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Completed"],
            default: "Pending",
        },
        requested_date: {
            type: Date,
            default: Date.now,
        },
        processed_date: {
            type: Date,
            default: null,
        },
        processed_by: {
            type: String,
            default: null,
        },
        rejection_reason: {
            type: String,
            default: null,
        },
        transaction_id: {
            type: String,
            default: null,
        },
    },
    { timestamps: true, collection: "withdrawRequest_tbl" }
);

const WithdrawRequestModel = mongoose.model("WithdrawRequest", withdrawRequestSchema);
module.exports = WithdrawRequestModel;
