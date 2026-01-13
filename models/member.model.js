const mongoose = require("mongoose");

const memberSchema = mongoose.Schema(
  {
    member_id: {
      type: String,
      required: true,
    },
    branch_id: {
      type: String,
      default: null,
    },
    date_of_joining: {
      type: Date,
      default: Date.now,
    },
    receipt_no: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      default: null,
    },
    father_name: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    age: {
      type: Number,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    emailid: {
      type: String,
      default: null,
    },
    contactno: {
      type: String,
      default: null,
      unique: true
    },
    pan_no: {
      type: String,
      default: null,
    },
    aadharcard_no: {
      type: String,
      default: null,
    },
    voter_id: {
      type: String,
      default: null,
    },
    nominee: {
      type: String,
      default: null,
    },
    relation: {
      type: String,
      default: null,
    },
    occupation: {
      type: String,
      default: null,
    },
    introducer: {
      type: String,
      default: null,
    },
    introducer_name: {
      type: String,
      default: null,
    },
    // Commission tracking
    commission_eligible: {
      type: Boolean,
      default: true,
    },
    commission_balance: {
      type: Number,
      default: 0,
    },
    introducer_hierarchy: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 7;
        },
        message: 'Introducer hierarchy cannot exceed 7 levels'
      }
    },
    member_image: {
      type: String,
      default: null,
    },
    member_signature: {
      type: String,
      default: null,
    },
    entered_by: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      default: "active",
    },
    role: {
      type: String,
      default: "USER",
    },
    // KYC fields
    account_number: {
      type: String,
      default: null,
    },
    ifsc_code: {
      type: String,
      default: null,
    },
    bank_name: {
      type: String,
      default: null,
    },
    kycStatus: {
      type: String,
      default: "PENDING",
    },
    beneficiaryStatus: {
      type: String,
      default: "NOT_CREATED",
    },
    beneficiaryId: {
      type: String,
      default: null,
    },
    bank_details: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, collection: "member_tbl" }
);

const MemberModel = mongoose.model("member_tbl", memberSchema);
module.exports = MemberModel;

