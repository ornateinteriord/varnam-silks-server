const MemberModel = require("../../models/member.model");
const UserModel = require("../../models/user.model");
const jwt = require("jsonwebtoken");
const {
  sendMail,
} = require("../../utils/EmailService");
const { generateOTP, storeOTP, verifyOTP } = require("../../utils/OtpService");
const { generateMSCSEmail } = require("../../utils/generateMSCSEmail");

const recoverySubject = "MSI - Password Recovery";
const resetPasswordSubject = "MSI - OTP Verification";

const generateUniqueMemberId = async () => {
  while (true) {
    const memberId = `MSI${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await MemberModel.exists({ member_id: memberId }))) {
      return memberId;
    }
  }
};

const signup = async (req, res) => {
  try {
    const { emailid, password, name, ...otherDetails } = req.body;
    // const existingUser = await MemberModel.findOne({ emailid });
    // if (existingUser) {
    //   return res.status(400).json({ success: false, message: "Email already in use" });
    // }

    const memberId = await generateUniqueMemberId();

    const newMember = new MemberModel({
      member_id: memberId,
      emailid,
      password,
      name,
      ...otherDetails,
    });
    await newMember.save();

    try {
      const { welcomeMessage, welcomeSubject } = generateMSCSEmail(memberId, password, name);
      const textContent = `Dear ${name}, Your account registration with MSI has been completed. Member ID: ${memberId}, Password: ${password}. Your account is under verification process.`;

      await sendMail(emailid, welcomeSubject, welcomeMessage, textContent);
    } catch (emailError) {
      // Email sending failed but continue
    }

    res.status(201).json({
      success: true,
      message: "Signup successful. Credentials sent to email.",
      user: {
        member_id: newMember.member_id,
        emailid: newMember.emailid,
        name: newMember.name
      },
    });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
