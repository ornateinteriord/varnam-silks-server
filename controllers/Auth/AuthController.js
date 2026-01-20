const MemberModel = require("../../models/member.model");
const UserModel = require("../../models/user.model");
const jwt = require("jsonwebtoken");
const {
  sendMail,
} = require("../../utils/EmailService");
const { generateOTP, storeOTP, verifyOTP } = require("../../utils/OtpService");
const { generateMSCSEmail } = require("../../utils/generateMSCSEmail");
const { addMemberHierarchy } = require("../../utils/hierarchyHelper");
const { generateWelcomeEmail } = require("../../utils/emailTemplates");

const recoverySubject = "MSI - Password Recovery";
const resetPasswordSubject = "MSI - OTP Verification";

const signup = async (req, res) => {
  try {
    const {
      name,
      emailid,
      password,
      contactno,
      pincode,
      gender,
      introducer,
      introducer_name,
      address,
      father_name,
      dob,
      pan_no,
      aadharcard_no,
    } = req.body;

    // Validate required fields
    if (!name || !contactno || !introducer) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: name, contactno, introducer"
      });
    }

    // Check if contactno already exists
    const existingContact = await MemberModel.findOne({ contactno });
    if (existingContact) {
      return res.status(400).json({
        success: false,
        message: "Contact number already registered. Please login instead."
      });
    }

    // Auto-increment member_id (same logic as admin createMember)
    const lastMember = await MemberModel.findOne()
      .sort({ member_id: -1 })
      .limit(1);

    let newMemberId = "105160";
    if (lastMember && lastMember.member_id) {
      const lastId = parseInt(lastMember.member_id);
      if (!isNaN(lastId)) {
        newMemberId = (lastId + 1).toString();
      }
    }

    // Prepare member data
    const memberData = {
      member_id: newMemberId,
      name,
      emailid,
      contactno,
      gender,
      address,
      father_name,
      dob,
      pan_no,
      aadharcard_no,
      pincode,
      introducer,
      introducer_name,
      role: "USER",
      status: "pending", // New registrations start as pending for admin approval
      commission_eligible: true,
    };

    // Build introducer hierarchy
    const memberDataWithHierarchy = await addMemberHierarchy(memberData);

    // Create member
    const newMember = await MemberModel.create(memberDataWithHierarchy);

    // Create user entry (password = contact number for public signup)
    const userPassword = password || contactno;
    try {
      const lastUser = await UserModel.findOne()
        .sort({ user_id: -1 })
        .limit(1);

      let newUserId = "105160";
      if (lastUser && lastUser.user_id) {
        const lastId = parseInt(lastUser.user_id);
        if (!isNaN(lastId)) {
          newUserId = (lastId + 1).toString();
        }
      }

      await UserModel.create({
        id: newUserId,
        user_id: newMemberId,
        user_name: newMemberId,
        reference_id: newMemberId,
        password: userPassword,
        user_role: "USER",
        user_status: "active"
      });

      console.log(`✅ User created for member ${newMemberId}`);
    } catch (userError) {
      console.error("❌ Error creating user entry:", userError);
    }

    // Send welcome email
    if (emailid) {
      try {
        const emailTemplate = generateWelcomeEmail(name, newMemberId, userPassword, 'Member');
        await sendMail(emailid, emailTemplate.subject, emailTemplate.html, emailTemplate.text);
        console.log(`✅ Welcome email sent to ${emailid}`);
      } catch (emailError) {
        console.error(`❌ Error sending welcome email:`, emailError.message);
      }
    }

    res.status(201).json({
      success: true,
      message: "Registration successful!.",
      data: {
        member_id: newMemberId,
        name: name,
        emailid: emailid
      }
    });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ success: false, message: error.message || "Registration failed" });
  }
};

const getSponsorDetails = async (req, res) => {
  try {
    const { ref } = req.params;
    const sponsor = await MemberModel.findOne({ member_id: ref });
    if (!sponsor) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid Sponsor Code" });
    }
    res.json({
      success: true,
      member_id: sponsor.member_id,
      name: sponsor.name,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const recoverPassword = async (req, res) => {
  try {
    const { emailid } = req.body;
    const user = await MemberModel.findOne({ emailid });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not registered" });
    }
    const recoveryDescription = `Dear Member,\n\nYou requested a password recovery. Here is your password:\n ${user.password}\n\nPlease keep this information secure.\n\nBest regards,\MSI Team`;

    await sendMail(user.emailid, recoverySubject, recoveryDescription);
    res.json({ success: true, message: "Password sent to your email" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const { generatePasswordUpdatedEmail } = require("../../utils/emailTemplates");

const resetPassword = async (req, res) => {
  try {
    const { emailid, password, otp } = req.body;
    const user = await MemberModel.findOne({ emailid });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not registered" });
    }

    if (otp && !password) {
      if (!verifyOTP(emailid, otp)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid OTP or expired" });
      }
      return res.json({ success: true, message: "OTP verified. Now set a new password." });
    }
    if (password) {

      user.password = password;
      await user.save();

      // 📧 Send password update email notification
      try {
        const emailTemplate = generatePasswordUpdatedEmail(user.name, user.member_id);
        await sendMail(user.emailid, emailTemplate.subject, emailTemplate.html, emailTemplate.text);
        console.log(`✅ Password update email sent to ${user.emailid}`);
      } catch (emailError) {
        console.error(`❌ Error sending password update email:`, emailError.message);
        // Don't fail password reset if email fails
      }

      return res.json({
        success: true,
        message: "Password reset successfully",
      });
    }
    const newOtp = generateOTP();
    const resetPasswordDescription = `Dear Member,\n\nYour OTP for password reset is: ${newOtp}\n\nPlease use this OTP to proceed with resetting your password.\n\nPlease keep don't share with anyone.\n\nBest regards,\nMSI Team`;
    storeOTP(emailid, newOtp);
    await sendMail(emailid, resetPasswordSubject, resetPasswordDescription);
    return res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by user_name
    const user = await UserModel.findOne({ user_name: username });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Verify password
    const isPasswordValid = password === user.password;
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect username or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.user_role,
        userId: user.user_id,
        user_name: user.user_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      success: true,
      role: user.user_role,
      user: user,
      token,
      message: `${user.user_role.charAt(0).toUpperCase() + user.user_role.slice(1).toLowerCase()
        } login successful`,
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message });
  }
};

module.exports = {
  signup,
  getSponsorDetails,
  recoverPassword,
  resetPassword,
  login,
};
