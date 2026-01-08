const mongoose = require("mongoose");

const receiptsSchema = mongoose.Schema(
  {
    receipt_id: {
      type: String,
      required: true,
    },
    receipt_date: {
      type: Date,
      default: null,
    },
    received_from: {
      type: String,
      default: null,
    },
    receipt_details: {
      type: String,
      default: null,
    },
    mode_of_payment_received: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      default: "pending",
    },
    ref_no: {
      type: String,
      default: null,
    },
    receipt_no: {
      type: String,
      default: null,
    },
    entered_by: {
      type: String,
      default: null,
    },
    branch_code: {
      type: String,
      default: null,
    },
    member_id: {
      type: String,
      default: null,
    },
    account_details: {
      account_no: {
        type: String,
        default: null,
      },
      account_type: {
        type: String,
        default: null,
      },
      account_id: {
        type: String,
        default: null,
      },
    },
  },
  { timestamps: true, collection: "receipts_tbl" }
);

const ReceiptsModel = mongoose.model("receipts_tbl", receiptsSchema);
module.exports = ReceiptsModel;

