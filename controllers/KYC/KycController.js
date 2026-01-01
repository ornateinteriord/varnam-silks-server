const MemberModel = require("../../models/member.model");
const axios = require("axios");
const cashfreeConfig = require("../../utils/cashfree");

/* =====================================================
   CASHFREE TOKEN CACHE
===================================================== */
let cachedToken = null;
let tokenExpiry = 0;

async function getCashfreeToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const res = await axios.post(
    `${cashfreeConfig.CASHFREE_BASE_URL}/payout/v1/authorize`,
    {},
    {
      headers: {
        "X-Client-Id": process.env.CI_APP_ID,
        "X-Client-Secret": process.env.CI_SECRET_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  const token = res.data?.data?.token;
  if (!token) throw new Error("Cashfree auth failed");

  cachedToken = token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 mins
  return token;
}

/* =====================================================
   BANK + NAME VALIDATION (STRICT)
===================================================== */
async function validateBank({ name, bankAccount, ifsc }) {
  const token = await getCashfreeToken();

  const res = await axios.get(
    `${cashfreeConfig.CASHFREE_BASE_URL}/payout/v1/validation/bankDetails`,
    {
      params: { name, bankAccount, ifsc },
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data;
}

/* =====================================================
   CREATE BENEFICIARY
===================================================== */
async function createBeneficiary(user) {
  if (user.beneficiaryStatus === "CREATED") return;

  const token = await getCashfreeToken();
  const beneficiaryId = `BEN_${user.member_id}`;

  const payload = {
    beneId: beneficiaryId,
    name: user.name,
    email: user.emailid,
    phone: user.contactno,
    bankAccount: user.account_number,
    ifsc: user.ifsc_code,
    address1: user.address || "India",
  };

  const res = await axios.post(
    `${cashfreeConfig.CASHFREE_BASE_URL}/payout/v1/addBeneficiary`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (res.data.status === "SUCCESS") {
    user.beneficiaryId = beneficiaryId;
    user.beneficiaryStatus = "CREATED";
    await user.save();
  }
}

/* =====================================================
   SUBMIT KYC (FULL AUTO – CASHFREE DRIVEN)
===================================================== */
exports.submitKYC = async (req, res) => {
  try {
    const { ref_no, bankAccount, ifsc, pan, address, bankName } = req.body;

    const member = await MemberModel.findOne({ member_id: ref_no });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    if (member.kycStatus === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "KYC already approved",
      });
    }

    // Save details first (audit safety)
    member.account_number = bankAccount;
    member.ifsc_code = ifsc;
    member.pan_no = pan;
    member.bank_name = bankName;
    member.address = address;
    member.kycStatus = "PROCESSING";
    await member.save();

    // 🔍 Call Cashfree (MANDATORY)
    const validation = await validateBank({
      name: member.name,
      bankAccount,
      ifsc,
    });

    console.log("🏦 Cashfree Validation Response:", validation);

    // ❌ If Cashfree fails → STOP
    if (validation.status !== "SUCCESS") {
      member.kycStatus = "FAILED";
      member.kycFailReason = validation.message || "Bank verification failed";
      await member.save();

      return res.status(400).json({
        success: false,
        message: "KYC failed",
        reason: member.kycFailReason,
      });
    }

    // ✅ Cashfree SUCCESS → AUTO APPROVE
    member.kycStatus = "APPROVED";
    await member.save();

    // 🚀 Create beneficiary
    setImmediate(() => createBeneficiary(member));

    return res.json({
      success: true,
      message: "KYC approved automatically via Cashfree",
    });
  } catch (err) {
    console.error("Auto KYC error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
