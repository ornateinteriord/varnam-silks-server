const mongoose = require("mongoose");

const agentSchema = mongoose.Schema(
  {
    agent_id: {
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
    name: {
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
    address: {
      type: String,
      default: null,
    },
    emailid: {
      type: String,
      default: null,
    },
    mobile: {
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
    entered_by: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      default: "active",
    },
    designation: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, collection: "agent_tbl" }
);

const AgentModel = mongoose.model("agent_tbl", agentSchema);
module.exports = AgentModel;

