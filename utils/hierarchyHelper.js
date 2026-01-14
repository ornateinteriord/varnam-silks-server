const { buildIntroducerHierarchy } = require("./commissionUtils");
const MemberModel = require("../models/member.model");
const AgentModel = require("../models/agent.model");

/**
 * Middleware to build introducer hierarchy when creating a new member
 * Call this BEFORE saving the member to the database
 */
const addMemberHierarchy = async (memberData) => {
    try {
        if (!memberData.introducer) {
            console.log("No introducer specified for member");
            memberData.introducer_hierarchy = [];
            return memberData;
        }

        // Determine introducer type (could be member or agent)
        let introducerType = "MEMBER";
        let introducer = await MemberModel.findOne({ member_id: memberData.introducer });

        if (!introducer) {
            // Check if it's an agent
            introducer = await AgentModel.findOne({ agent_id: memberData.introducer });
            introducerType = "AGENT";
        }

        if (!introducer) {
            console.warn(`Introducer ${memberData.introducer} not found`);
            memberData.introducer_hierarchy = [memberData.introducer];
            return memberData;
        }

        // Build hierarchy
        const hierarchy = await buildIntroducerHierarchy(memberData.introducer, introducerType);
        memberData.introducer_hierarchy = hierarchy;

        // Set introducer_name if not already set
        if (!memberData.introducer_name && introducer.name) {
            memberData.introducer_name = introducer.name;
        }

        console.log(`Built member hierarchy: ${hierarchy.length} levels`);
        return memberData;
    } catch (error) {
        console.error("Error building member hierarchy:", error);
        // Don't fail member creation, just log the error
        memberData.introducer_hierarchy = memberData.introducer ? [memberData.introducer] : [];
        return memberData;
    }
};

/**
 * Middleware to build introducer hierarchy when creating a new agent
 * Call this BEFORE saving the agent to the database
 */
const addAgentHierarchy = async (agentData) => {
    try {
        if (!agentData.introducer) {
            console.log("No introducer specified for agent");
            agentData.introducer_hierarchy = [];
            return agentData;
        }

        // For agents, the introducer is typically another agent
        let introducerType = "AGENT";
        let introducer = await AgentModel.findOne({ agent_id: agentData.introducer });

        if (!introducer) {
            // Could also be a member in some cases
            introducer = await MemberModel.findOne({ member_id: agentData.introducer });
            introducerType = "MEMBER";
        }

        if (!introducer) {
            console.warn(`Introducer ${agentData.introducer} not found`);
            agentData.introducer_hierarchy = [agentData.introducer];
            return agentData;
        }

        // Build hierarchy
        const hierarchy = await buildIntroducerHierarchy(agentData.introducer, introducerType);
        agentData.introducer_hierarchy = hierarchy;

        // Set introducer_name if not already set
        if (!agentData.introducer_name && introducer.name) {
            agentData.introducer_name = introducer.name;
        }

        console.log(`Built agent hierarchy: ${hierarchy.length} levels`);
        return agentData;
    } catch (error) {
        console.error("Error building agent hierarchy:", error);
        // Don't fail agent creation, just log the error
        agentData.introducer_hierarchy = agentData.introducer ? [agentData.introducer] : [];
        return agentData;
    }
};

/**
 * Update existing members to build their hierarchy
 * This is a one-time migration function
 * @param {boolean} forceRebuild - If true, rebuild all hierarchies even if they exist
 */
const migrateExistingMembersHierarchy = async (forceRebuild = false) => {
    try {
        console.log("Starting member hierarchy migration...");
        console.log(`Force rebuild: ${forceRebuild}`);

        const members = await MemberModel.find({ introducer: { $ne: null } });
        let updated = 0;
        let skipped = 0;

        for (const member of members) {
            // Check if we should update this member
            const shouldUpdate = forceRebuild || !member.introducer_hierarchy || member.introducer_hierarchy.length === 0;

            if (shouldUpdate) {
                const oldHierarchy = member.introducer_hierarchy?.length || 0;
                await addMemberHierarchy(member);
                await member.save();
                const newHierarchy = member.introducer_hierarchy?.length || 0;
                console.log(`  Updated ${member.member_id} (${member.name}): ${oldHierarchy} -> ${newHierarchy} levels`);
                if (newHierarchy > 0) {
                    console.log(`    Hierarchy: ${member.introducer_hierarchy.join(' -> ')}`);
                }
                updated++;
            } else {
                skipped++;
            }
        }

        console.log(`Migration complete: ${updated} members updated, ${skipped} skipped`);
        return { success: true, updated, skipped };
    } catch (error) {
        console.error("Error migrating member hierarchy:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Update existing agents to build their hierarchy
 * This is a one-time migration function
 * @param {boolean} forceRebuild - If true, rebuild all hierarchies even if they exist
 */
const migrateExistingAgentsHierarchy = async (forceRebuild = false) => {
    try {
        console.log("Starting agent hierarchy migration...");
        console.log(`Force rebuild: ${forceRebuild}`);

        const agents = await AgentModel.find({ introducer: { $ne: null } });
        let updated = 0;
        let skipped = 0;

        for (const agent of agents) {
            // Check if we should update this agent
            const shouldUpdate = forceRebuild || !agent.introducer_hierarchy || agent.introducer_hierarchy.length === 0;

            if (shouldUpdate) {
                const oldHierarchy = agent.introducer_hierarchy?.length || 0;
                await addAgentHierarchy(agent);
                await agent.save();
                const newHierarchy = agent.introducer_hierarchy?.length || 0;
                console.log(`  Updated ${agent.agent_id} (${agent.name}): ${oldHierarchy} -> ${newHierarchy} levels`);
                if (newHierarchy > 0) {
                    console.log(`    Hierarchy: ${agent.introducer_hierarchy.join(' -> ')}`);
                }
                updated++;
            } else {
                skipped++;
            }
        }

        console.log(`Migration complete: ${updated} agents updated, ${skipped} skipped`);
        return { success: true, updated, skipped };
    } catch (error) {
        console.error("Error migrating agent hierarchy:", error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    addMemberHierarchy,
    addAgentHierarchy,
    migrateExistingMembersHierarchy,
    migrateExistingAgentsHierarchy,
};
