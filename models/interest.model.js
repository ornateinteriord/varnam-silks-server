const mongoose = require("mongoose");

const interestSchema = new mongoose.Schema(
  {
    interest_id: {
      type: String,
      required: true,
      unique: true,
    },

    plan_type: {
      type: String,
      enum: ["FD", "RD", "PIGMY", "SAVING"],
      required: true,
    },

    interest_name: {
      type: String,
      required: true,
    },

    duration: {
      type: Number, // months
      required: true,
    },

    interest_rate_general: {
      type: Number,
      required: true,
    },

    interest_rate_senior: {
      type: Number,
      required: true,
    },

    minimum_deposit: {
      type: Number,
      default: 0,
    },

    from_date: {
      type: Date,
      default: new Date(),
    },

    to_date: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
    collection: "interest_tbl",
  }
);

module.exports = mongoose.model("interest_tbl", interestSchema);
