const mongoose = require("mongoose");

const interestSchema = mongoose.Schema(
  {
    interest_id: {
      type: String,
      required: true,
    },
    ref_id: {
      type: String,
      default: null,
    },
    interest_name: {
      type: String,
      default: null,
    },
    interest_rate_general: {
      type: Number,
      default: null,
    },
    interest_rate_senior: {
      type: Number,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    from_date: {
      type: Date,
      default: null,
    },
    to_date: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      default: "active",
    },
  },
  { timestamps: true, collection: "interest_tbl" }
);

const InterestModel = mongoose.model("interest_tbl", interestSchema);
module.exports = InterestModel;

