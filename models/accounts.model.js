const mongoose = require("mongoose");

const accountsSchema = mongoose.Schema(
  {
    account_id: {
      type: String,
      required: true,
    },
    branch_id: {
      type: String,
      default: null,
    },
    date_of_opening: {
      type: Date,
      default: Date.now,
    },
    member_id: {
      type: String,
      default: null,
    },
    account_type: {
      type: String,
      default: null,
    },
    account_no: {
      type: String,
      default: null,
    },
    account_operation: {
      type: String,
      default: null,
    },
    introducer: {
      type: String,
      default: null,
    },
    entered_by: {
      type: String,
      default: null,
    },
    ref_id: {
      type: String,
      default: null,
    },
    interest_rate: {
      type: Number,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    date_of_maturity: {
      type: Date,
      default: null,
    },
    date_of_close: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      default: "pending",
    },
    assigned_to: {
      type: String,
      default: null,
    },
    account_amount: {
      type: Number,
      default: null,
    },
    joint_member: {
      type: String,
      default: null,
    },
    interest_amount: {
      type: Number,
      default: null,
    },
    net_amount: {
      type: Number,
      default: null,
    },
    maturity_processed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, collection: "accounts_tbl" }
);

const AccountsModel = mongoose.model("accounts_tbl", accountsSchema);
module.exports = AccountsModel;

