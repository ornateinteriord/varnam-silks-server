const express = require("express");
const router = express.Router();
const {
    login,
    signup,
} = require("../controllers/Auth/AuthController");
const MemberModel = require("../models/member.model");
const AgentModel = require("../models/agent.model");

// ====================== Auth Routes ======================

// Login route
router.post("/login", login);

// Signup route (public registration)
router.post("/signup", signup);

// Get introducer/sponsor details by ID (for registration referral)
router.get("/get-sponsor/:ref", async (req, res) => {
    try {
        const { ref } = req.params;

        // Search for member/agent by their ID (who will be the introducer)
        // Try both string and numeric formats
        const member = await MemberModel.findOne({
            $or: [
                { member_id: ref },
                { member_id: String(ref) },
                { member_id: parseInt(ref) || ref }
            ]
        });

        if (member) {
            return res.json({
                success: true,
                data: {
                    id: member.member_id,
                    name: member.name,
                    type: "member"
                }
            });
        }

        // Try agent
        const agent = await AgentModel.findOne({
            $or: [
                { agent_id: ref },
                { agent_id: String(ref) },
                { agent_id: parseInt(ref) || ref }
            ]
        });

        if (agent) {
            return res.json({
                success: true,
                data: {
                    id: agent.agent_id,
                    name: agent.name,
                    type: "agent"
                }
            });
        }

        return res.status(404).json({
            success: false,
            message: "Introducer not found"
        });

    } catch (error) {
        console.error("Get Sponsor Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
