const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        transaction_id: {
            type: String,
            required: true,
            unique: true,
        },
        transaction_date: {
            type: Date,
            default: Date.now,
            index: true,
        },
        member_id: {
            type: String, // Unified ID for Agent, Member, or Admin
            required: true,
            index: true,
        },
        account_number: {
            type: String,
            default: null,
        },
        account_type: {
            type: String,
            default: 'Other',
        },
        transaction_type: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            default: "",
        },
        credit: {
            type: Number,
            default: 0,
        },
        debit: {
            type: Number,
            default: 0,
        },
        ew_debit: {
            type: String,
            default: "0",
        },
        balance: {
            type: Number,
            default: 0,
        },
        Name: {
            type: String,
            default: null,
        },
        mobileno: {
            type: String,
            default: null,
        },
        benefit_type: {
            type: String,
            default: "direct",
        },
        status: {
            type: String,
            default: "Pending", // Pending, Completed, Failed
        },
        reference_no: {
            type: String,
            default: null,
        },
        collected_by: {
            type: String,
            default: null,
        },
        paid_by: {
            type: String,
            default: null,
        },
    },
    { timestamps: true, collection: "transaction_tbl" }
);

module.exports = mongoose.model("Transaction", transactionSchema);
