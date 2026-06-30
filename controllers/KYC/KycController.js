const MemberModel = require("../../models/member.model");
const axios = require("axios");
const razorpayConfig = require("../../utils/razorpay");

/* =====================================================
   CREATE RAZORPAY CONTACT & FUND ACCOUNT
===================================================== */
async function createRazorpayFundAccount(user, bankAccount, ifsc, bankName) {
  try {
    const auth = {
      username: razorpayConfig.RAZORPAY_KEY_ID,
      password: razorpayConfig.RAZORPAY_KEY_SECRET,
    };

    let contactId = user.razorpay_contact_id;

    // 1. Create Contact if not exists
    if (!contactId) {
      console.log(`👤 Creating Razorpay Contact for ${user.member_id}...`);
      const contactPayload = {
        name: user.name,
        email: user.emailid || "noemail@example.com",
        contact: user.contactno,
        type: "customer",
        reference_id: user.member_id,
      };

      const contactRes = await axios.post(
        "https://api.razorpay.com/v1/contacts",
        contactPayload,
        { auth, headers: { "Content-Type": "application/json" } }
      );

      contactId = contactRes.data.id;
      user.razorpay_contact_id = contactId;
      await user.save();
      console.log(`✅ Razorpay Contact Created: ${contactId}`);
    } else {
      console.log(`✅ Using existing Razorpay Contact: ${contactId}`);
    }

    // 2. Create Fund Account
    console.log(`🏦 Creating Razorpay Fund Account for Contact ${contactId}...`);
    const fundAccountPayload = {
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: user.name,
        ifsc: ifsc,
        account_number: bankAccount,
      },
    };

    const fundRes = await axios.post(
      "https://api.razorpay.com/v1/fund_accounts",
      fundAccountPayload,
      { auth, headers: { "Content-Type": "application/json" } }
    );

    const fundAccountId = fundRes.data.id;
    user.razorpay_fund_account_id = fundAccountId;
    await user.save();
    console.log(`✅ Razorpay Fund Account Created: ${fundAccountId}`);

    return { success: true, contactId, fundAccountId };
  } catch (error) {
    console.error("❌ RazorpayX Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.description || error.message);
  }
}

/* =====================================================
   SUBMIT KYC (RAZORPAYX DRIVEN)
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

    // 🧪 SANDBOX BYPASS MODE (For local testing without Gateway)
    const SANDBOX_BYPASS = process.env.ENABLE_KYC_SANDBOX_BYPASS === "true";

    if (SANDBOX_BYPASS) {
      console.log("🧪 SANDBOX MODE: Bypassing Razorpay validation");
      console.log("   Member:", member.name);
      console.log("   Bank Account:", bankAccount);
      console.log("   IFSC:", ifsc);

      // Auto-approve in sandbox mode
      member.kycStatus = "APPROVED";
      await member.save();

      return res.json({
        success: true,
        message: "KYC approved automatically (SANDBOX MODE)",
        sandbox: true,
      });
    }

    // 🔍 Call RazorpayX (MANDATORY in production)
    try {
      const razorpayResult = await createRazorpayFundAccount(member, bankAccount, ifsc, bankName);
      
      console.log("🏦 RazorpayX Result:", razorpayResult);

      // We assume creation of contact & fund account = APPROVED for now, 
      // actual FAV (Fund Account Validation) via penny drop could be done via webhooks later if needed.
      member.kycStatus = "APPROVED";
      await member.save();

      return res.json({
        success: true,
        message: "KYC approved successfully",
      });
    } catch (razorpayError) {
      console.error("Razorpay API error:", razorpayError.message);

      member.kycStatus = "FAILED";
      member.kycFailReason = `Razorpay error: ${razorpayError.message}`;
      await member.save();

      return res.status(500).json({
        success: false,
        message: "KYC validation failed",
        error: "Gateway service unavailable",
        details: razorpayError.message
      });
    }
  } catch (err) {
    console.error("Auto KYC error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
};
