const TransactionModel = require("../../models/transaction.model");
const CommissionModel = require("../../models/commission.model");
const MemberModel = require("../../models/member.model");

// Get all transactions for a specific user/member
const getUserTransactions = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { account_type, type } = req.query;
        
        const filterAccountType = account_type || type;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // Build query filter
        const filter = { member_id: memberId };
        if (filterAccountType && filterAccountType !== 'all') {
            filter.account_type = filterAccountType;
        }

        // Find all transactions for this member (optionally filtered by account type)
        const transactions = await TransactionModel.find(filter)
            .sort({ transaction_date: -1 })
            .select('transaction_id transaction_date account_number account_type transaction_type description credit debit balance status reference_no');

        res.status(200).json({
            success: true,
            message: "User transactions fetched successfully",
            data: transactions
        });
    } catch (error) {
        console.error("Error fetching user transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user transactions",
            error: error.message
        });
    }
};

const WithdrawRequestModel = require("../../models/withdrawRequest.model");

// ... (existing code for getUserTransactions)

// Get all commission transactions for a member
const getCommissionTransactions = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // 1. Fetch Commission Credits (EARNED)
        const commissions = await CommissionModel.find({
            beneficiary_id: memberId,
            status: { $in: ['CREDITED', 'PENDING'] } // Only get earnings, not withdrawals (if any old ones exist)
        }).lean();

        // 2. Fetch Withdrawal Requests (DEBITS) - All statuses
        const withdrawals = await WithdrawRequestModel.find({
            member_id: memberId,
            source_type: 'Commission'
        }).lean();

        // 3. Calculate Totals
        const totalEarned = commissions
            .filter(c => c.status === "CREDITED")
            .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

        const totalPendingCommissions = commissions
            .filter(c => c.status === "PENDING")
            .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

        const totalWithdrawn = withdrawals
            .filter(w => w.status === 'Completed' || w.status === 'Approved')
            .reduce((sum, w) => sum + (w.amount || 0), 0);

        const totalPendingWithdrawals = withdrawals
            .filter(w => w.status === 'Pending')
            .reduce((sum, w) => sum + (w.amount || 0), 0);

        // 4. Calculate Available Balance
        const availableBalance = totalEarned - (totalWithdrawn + totalPendingWithdrawals);

        // 5. Merge and Format Transactions for Frontend
        const commissionDocs = commissions.map(c => ({
            _id: c._id,
            transaction_id: c.transaction_id || c.commission_id,
            date: c.transaction_date || c.createdAt,
            description: c.description || 'Commission Received',
            amount: c.commission_amount,
            status: c.status,
            type: 'CREDIT',
            source: 'Commission'
        }));

        const withdrawalDocs = withdrawals.map(w => ({
            _id: w._id,
            transaction_id: w.transaction_id || w.withdraw_request_id,
            date: w.requested_date || w.createdAt,
            description: `Withdrawal Request${w.status === 'Rejected' ? ' (Rejected)' : ''}`,
            amount: w.amount,
            status: w.status === 'Completed' ? 'WITHDRAWN' : w.status === 'Pending' ? 'PENDING' : w.status,
            type: 'DEBIT',
            source: 'Withdrawal'
        }));

        // Combine and Sort by Date Descending
        const allTransactions = [...commissionDocs, ...withdrawalDocs].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        res.status(200).json({
            success: true,
            message: "Commission transactions fetched successfully",
            data: {
                transactions: allTransactions,
                summary: {
                    totalEarned,
                    totalPending: totalPendingCommissions,
                    totalWithdrawn: totalWithdrawn + totalPendingWithdrawals,
                    availableBalance: availableBalance > 0 ? availableBalance : 0
                }
            }
        });
    } catch (error) {
        console.error("Error fetching commission transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch commission transactions",
            error: error.message
        });
    }
};

// Get direct sponsors (tree logic)
const getSponsers = async (req, res) => {
    try {
        const { memberId } = req.params;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // Fetch user basic details for the top node
        const parentUser = await MemberModel.findOne({ member_id: memberId })
            .select("name member_id status profile_image date_of_joining");

        if (!parentUser) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        // Fetch direct sponsored users (children nodes)
        const sponsoredUsers = await MemberModel.find({ introducer: memberId })
            .select("name member_id status profile_image date_of_joining");

        res.status(200).json({
            success: true,
            message: "Sponsors fetched successfully",
            parentUser: {
                Name: parentUser.name,
                Member_id: parentUser.member_id,
                status: parentUser.status,
                profile_image: parentUser.member_image,
                Date_of_joining: parentUser.date_of_joining
            },
            sponsoredUsers: sponsoredUsers.map(user => ({
                Name: user.name,
                Member_id: user.member_id,
                status: user.status,
                profile_image: user.member_image,
                Date_of_joining: user.date_of_joining
            }))
        });
    } catch (error) {
        console.error("Error fetching sponsors:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sponsors",
            error: error.message
        });
    }
};

// Get multi-level sponsors for the logged-in user
const getMultiLevelSponsors = async (req, res) => {
    try {
        const memberId = req.user.userId;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: "Member ID is required"
            });
        }

        // Find all members who have this memberId in their introducer_hierarchy
        const downline = await MemberModel.find({ introducer_hierarchy: memberId }).lean();

        // Calculate levels
        const levels = {};

        downline.forEach(member => {
            if (!member.introducer_hierarchy) return;
            
            // Find the index of memberId in the hierarchy
            // Hierarchy is typically built from direct introducer outwards
            // e.g., [directSponsorId, grandSponsorId, greatGrandSponsorId]
            // If we find our memberId at index 0, this member is Level 1 to us
            // If we find it at index 1, this member is Level 2 to us
            const levelIndex = member.introducer_hierarchy.findIndex(id => String(id) === String(memberId));
            
            if (levelIndex !== -1) {
                const level = levelIndex + 1; // 1-based level
                
                if (!levels[level]) {
                    levels[level] = { level, total: 0, active: 0, pending: 0 };
                }
                
                levels[level].total += 1;
                
                const status = (member.status || '').toLowerCase();
                if (status === 'active') {
                    levels[level].active += 1;
                } else if (status === 'pending') {
                    levels[level].pending += 1;
                }
            }
        });

        // Convert to array and sort by level
        const data = Object.values(levels).sort((a, b) => a.level - b.level);

        res.status(200).json({
            success: true,
            message: "Multi-level sponsorship data fetched successfully",
            data: data
        });
    } catch (error) {
        console.error("Error fetching multi-level sponsors:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch multi-level sponsorship data",
            error: error.message
        });
    }
};

module.exports = {
    getUserTransactions,
    getCommissionTransactions,
    getSponsers,
    getMultiLevelSponsors
};
