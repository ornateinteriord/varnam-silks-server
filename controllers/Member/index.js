const AccountsModel = require("../../models/accounts.model");
const MemberModel = require("../../models/member.model");

// Get logged-in member's account summary
const getMyAccounts = async (req, res) => {
    try {
        // Get member_id from authenticated user
        const memberId = req.user.memberId || req.user.userId;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID not found in token"
            });
        }

        // Get all accounts for this member with account group information
        const accounts = await AccountsModel.aggregate([
            {
                $match: {
                    $or: [
                        { member_id: memberId },           // String comparison
                        { member_id: parseInt(memberId) }   // Number comparison
                    ]
                }
            },
            {
                $lookup: {
                    from: "account_group_tbl",
                    localField: "account_type",
                    foreignField: "account_group_id",
                    as: "groupInfo"
                }
            },
            {
                $unwind: {
                    path: "$groupInfo",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: "$account_type",
                    account_group_name: { $first: "$groupInfo.account_group_name" },
                    count: { $sum: 1 },
                    accounts: {
                        $push: {
                            account_id: "$account_id",
                            member_id: "$member_id",
                            account_no: "$account_no",
                            account_type: "$account_type",
                            account_amount: "$account_amount",
                            status: "$status",
                            date_of_opening: "$date_of_opening"
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    account_type: "$_id",
                    account_group_name: 1,
                    count: 1,
                    accounts: 1
                }
            },
            {
                $sort: { account_type: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            message: "Member accounts fetched successfully",
            data: {
                accountTypes: accounts,
                totalAccounts: accounts.reduce((sum, acc) => sum + acc.count, 0)
            }
        });
    } catch (error) {
        console.error("Error fetching member accounts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch member accounts",
            error: error.message
        });
    }
};

// Update logged-in member's profile
const updateMyProfile = async (req, res) => {
    try {
        const memberId = req.params.memberId;
        const updateData = req.body;

        // Validate that the logged-in user is updating their own profile
        const loggedInMemberId = req.user.memberId || req.user.userId;
        if (memberId !== loggedInMemberId) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own profile"
            });
        }

        // Remove fields that shouldn't be updated by user
        delete updateData.member_id;
        delete updateData.emailid;  // Email cannot be changed
        delete updateData.contactno; // Contact cannot be changed
        delete updateData.branch_id;
        delete updateData.date_of_joining;
        delete updateData.receipt_no;
        delete updateData.entered_by;
        delete updateData.status;
        delete updateData.introducer;
        delete updateData.introducer_name;
        delete updateData._id;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        // Find and update the member
        const updatedMember = await MemberModel.findOneAndUpdate(
            { member_id: memberId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedMember) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updatedMember
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: error.message
        });
    }
};

// Get member basic info (for recipient lookup during transfer)
const getMemberBasicInfo = async (req, res) => {
    try {
        const { memberId } = req.params;

        const allMembers = await MemberModel.find({});
        const member = allMembers.find(m => m.member_id === memberId);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        if (member.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Member account is not active"
            });
        }

        res.status(200).json({
            success: true,
            message: "Member info fetched successfully",
            data: {
                member_id: member.member_id,
                name: member.name,
                contact: member.contactno,
                email: member.emailid
            }
        });
    } catch (error) {
        console.error("Error fetching member info:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch member info",
            error: error.message
        });
    }
};

// Get member's accounts (without balance - for recipient account selection)
const getMemberAccountsPublic = async (req, res) => {
    try {
        const { memberId } = req.params;

        // Verify member exists and is active
        const allMembers = await MemberModel.find({});
        const member = allMembers.find(m => m.member_id === memberId);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        if (member.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "Member account is not active"
            });
        }

        // Get accounts with account group names but WITHOUT balances
        // Handle both string and number types for member_id
        const accounts = await AccountsModel.aggregate([
            {
                $match: {
                    $or: [
                        { member_id: memberId },           // String comparison
                        { member_id: parseInt(memberId) }   // Number comparison
                    ],
                    status: "active"
                }
            },
            {
                $lookup: {
                    from: "account_group_tbl",
                    localField: "account_type",
                    foreignField: "account_group_id",
                    as: "groupInfo"
                }
            },
            {
                $unwind: {
                    path: "$groupInfo",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    account_id: 1,
                    account_no: 1,
                    account_type: 1,
                    account_group_name: "$groupInfo.account_group_name",
                    date_of_opening: 1
                    // Explicitly NOT including account_amount for privacy
                }
            },
            {
                $sort: { date_of_opening: -1 }
            }
        ]);

        res.status(200).json({
            success: true,
            message: "Member accounts fetched successfully",
            data: accounts
        });
    } catch (error) {
        console.error("Error fetching member accounts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch member accounts",
            error: error.message
        });
    }
};

// Get member transactions with optional account_type filter
const getMemberTransactions = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { account_type } = req.query;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // Build query filter
        const filter = { member_id: memberId };
        if (account_type) {
            filter.account_type = account_type;
        }

        // Find all transactions for this member (optionally filtered by account type)
        const TransactionModel = require("../../models/transaction.model");
        const transactions = await TransactionModel.find(filter)
            .sort({ transaction_date: -1 })
            .select('transaction_id transaction_date account_number account_type transaction_type description credit debit balance status reference_no');

        res.status(200).json({
            success: true,
            message: "Member transactions fetched successfully",
            data: transactions
        });
    } catch (error) {
        console.error("Error fetching member transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch member transactions",
            error: error.message
        });
    }
};

module.exports = {
    getMyAccounts,
    updateMyProfile,
    getMemberBasicInfo,
    getMemberAccountsPublic,
    getMemberTransactions
};
