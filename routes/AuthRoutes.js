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
        const cleanRef = String(ref).trim();

        // Search for member/agent by their ID (who will be the introducer)
        const member = await MemberModel.findOne({
            $or: [
                { member_id: cleanRef },
                { Member_id: cleanRef },
                { member_id: { $regex: new RegExp(`^${cleanRef}$`, "i") } },
                { Member_id: { $regex: new RegExp(`^${cleanRef}$`, "i") } }
            ]
        }).lean();

        if (member) {
            return res.json({
                success: true,
                data: {
                    id: member.member_id || member.Member_id,
                    name: member.name || member.Name,
                    type: "member"
                }
            });
        }

        // Try agent
        const agent = await AgentModel.findOne({
            $or: [
                { agent_id: cleanRef },
                { Agent_id: cleanRef },
                { agent_id: { $regex: new RegExp(`^${cleanRef}$`, "i") } },
                { Agent_id: { $regex: new RegExp(`^${cleanRef}$`, "i") } }
            ]
        }).lean();

        if (agent) {
            return res.json({
                success: true,
                data: {
                    id: agent.agent_id || agent.Agent_id,
                    name: agent.name || agent.Name,
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
