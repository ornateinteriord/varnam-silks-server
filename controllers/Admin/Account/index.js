const AccountsModel = require("../../../models/accounts.model");
const InterestModel = require("../../../models/interest.model");
const AccountGroupModel = require("../../../models/accountGroup.model");
const AccountBookModel = require("../../../models/accountBook.model");
const MemberModel = require("../../../models/member.model");

// Get interests by account_group_id
const getInterestsByAccountGroup = async (req, res) => {
    try {
        const { account_group_id } = req.params;

        // Validate account_group_id
        if (!account_group_id) {
            return res.status(400).json({
                success: false,
                message: "Account group ID is required"
            });
        }

        // Find interests where ref_id matches the account_group_id
        const interests = await InterestModel.find({
            ref_id: account_group_id,
            status: "active"
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Interests fetched successfully",
            data: interests
        });
    } catch (error) {
        console.error("Error fetching interests:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch interests",
            error: error.message
        });
    }
};

// Create a new account
const createAccount = async (req, res) => {
    try {
        const {
            branch_id,
            date_of_opening,
            member_id,
            account_type, // This is account_group_id (e.g., AGP005, AGP001, etc.)
            account_operation,
            introducer,
            entered_by,
            ref_id, // This will be the interest_id if applicable
            interest_rate,
            duration,
            date_of_maturity,
            assigned_to,
            account_amount,
            joint_member
        } = req.body;

        // Validate required fields
        if (!member_id || !account_type) {
            return res.status(400).json({
                success: false,
                message: "Member ID and Account Type are required"
            });
        }

        // Get the account group to determine the prefix for account_no
        const accountGroup = await AccountGroupModel.findOne({
            account_group_id: account_type
        });

        if (!accountGroup) {
            return res.status(404).json({
                success: false,
                message: "Account type not found"
            });
        }

        // Check if member already has an account of this type
        const existingAccount = await AccountsModel.findOne({
            member_id: member_id,
            account_type: account_type,
            status: { $nin: ["closed", "inactive"] } // Only check for active/pending accounts
        });

        if (existingAccount) {
            return res.status(409).json({
                success: false,
                message: `Member already has an active ${accountGroup.account_group_name} account (${existingAccount.account_no || existingAccount.account_id}). Cannot create duplicate account type.`
            });
        }

        // Auto-increment account_id with ACC prefix
        const lastAccount = await AccountsModel.findOne()
            .sort({ account_id: -1 })
            .limit(1);

        let newAccountId = "ACC000001"; // Default starting ID
        if (lastAccount && lastAccount.account_id) {
            // Extract numeric part from format "ACCXXXXXX" and increment
            const numericPart = lastAccount.account_id.replace(/^ACC/, '');
            const lastId = parseInt(numericPart);
            if (!isNaN(lastId)) {
                const nextId = lastId + 1;
                // Format with ACC prefix and pad to 6 digits
                newAccountId = `ACC${nextId.toString().padStart(6, '0')}`;
            }
        }

        // Auto-increment account_no based on member_id and account_type
        // Format: [member_id][group_suffix][sequence]
        // Example: For member 10512 with PIGMY (AGP005), account_no could be 105600001
        // The pattern seems to be: first 3 digits of member_id + group sequence number + running number

        // Find the last account for this account type to determine next account number
        const lastAccountByType = await AccountsModel.findOne({
            account_type: account_type
        }).sort({ account_no: -1 }).limit(1);

        let newAccountNo;
        if (lastAccountByType && lastAccountByType.account_no) {
            // Increment the last account number
            const lastAccountNo = parseInt(lastAccountByType.account_no);
            if (!isNaN(lastAccountNo)) {
                newAccountNo = lastAccountNo + 1;
            } else {
                // If parsing fails, create new one based on member_id
                const memberIdPrefix = member_id.toString().substring(0, 3);
                const groupSuffix = "60"; // This could be derived from account_group_id if needed
                newAccountNo = parseInt(`${memberIdPrefix}${groupSuffix}0001`);
            }
        } else {
            // First account for this type
            const memberIdPrefix = member_id.toString().substring(0, 3);
            const groupSuffix = "60"; // This could be customized based on account type
            newAccountNo = parseInt(`${memberIdPrefix}${groupSuffix}0001`);
        }

        // Create new account
        const newAccount = await AccountsModel.create({
            account_id: newAccountId,
            branch_id,
            date_of_opening: date_of_opening || Date.now(),
            member_id,
            account_type,
            account_no: newAccountNo,
            account_operation: account_operation || "Single",
            introducer,
            entered_by,
            ref_id,
            interest_rate: interest_rate || 0,
            duration: duration || 0,
            date_of_maturity,
            date_of_close: null,
            status: "active",
            assigned_to,
            account_amount: account_amount || 0,
            joint_member
        });

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: newAccount
        });
    } catch (error) {
        console.error("Error creating account:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create account",
            error: error.message
        });
    }
};

// Get all accounts
const getAccounts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, account_type } = req.query;

        // Build filter object
        const filter = {};
        if (status) {
            filter.status = status;
        }
        if (account_type) {
            filter.account_type = account_type;
        }
        if (search) {
            filter.$or = [
                { account_id: { $regex: search, $options: "i" } },
                { account_no: { $regex: search, $options: "i" } },
                { member_id: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const accounts = await AccountsModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalAccounts = await AccountsModel.countDocuments(filter);

        // Fetch member details for each account
        const accountsWithMemberDetails = await Promise.all(
            accounts.map(async (account) => {
                const accountObj = account.toObject();

                if (accountObj.member_id) {
                    // Fetch member details
                    const member = await MemberModel.findOne(
                        { member_id: accountObj.member_id },
                        { name: 1, contactno: 1, emailid: 1, address: 1, _id: 0 }
                    );

                    if (member) {
                        accountObj.memberDetails = {
                            name: member.name,
                            contactno: member.contactno,
                            emailid: member.emailid,
                            address: member.address
                        };
                    }
                }

                return accountObj;
            })
        );

        res.status(200).json({
            success: true,
            message: "Accounts fetched successfully",
            data: accountsWithMemberDetails,
            pagination: {
                total: totalAccounts,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalAccounts / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching accounts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch accounts",
            error: error.message
        });
    }
};

// Get a single account by ID
const getAccountById = async (req, res) => {
    try {
        const { accountId } = req.params;

        // Use direct findOne instead of fetching all
        const account = await AccountsModel.findOne({
            $or: [
                { account_id: accountId },
                { account_id: accountId.toString() }
            ]
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Account fetched successfully",
            data: account
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch account",
            error: error.message
        });
    }
};

// Update an account by ID
const updateAccount = async (req, res) => {
    try {
        const { accountId } = req.params;
        const updateData = req.body;

        // Find account by account_id
        const account = await AccountsModel.findOne({ account_id: accountId });
        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found"
            });
        }

        // Update the account
        const updatedAccount = await AccountsModel.findOneAndUpdate(
            { account_id: accountId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Account updated successfully",
            data: updatedAccount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update account",
            error: error.message
        });
    }
};

// Get all account books
const getAccountBooks = async (req, res) => {
    try {
        const accountBooks = await AccountBookModel.find({ status: "active" })
            .sort({ account_book_name: 1 });

        res.status(200).json({
            success: true,
            message: "Account books fetched successfully",
            data: accountBooks
        });
    } catch (error) {
        console.error("Error fetching account books:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch account books",
            error: error.message
        });
    }
};

// Get all account groups (optionally filtered by account_book_id)
const getAccountGroups = async (req, res) => {
    try {
        const { account_book_id } = req.query;

        const filter = { status: "active" };
        if (account_book_id) {
            filter.account_book_id = account_book_id;
        }

        const accountGroups = await AccountGroupModel.find(filter)
            .sort({ account_group_name: 1 });

        res.status(200).json({
            success: true,
            message: "Account groups fetched successfully",
            data: accountGroups
        });
    } catch (error) {
        console.error("Error fetching account groups:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch account groups",
            error: error.message
        });
    }
};

// Get pre-maturity accounts (date_of_maturity >= today)
const getPreMaturityAccounts = async (req, res) => {
    try {
        const { account_type, date_of_maturity, page = 1, limit = 10 } = req.query;

        // Build filter object
        const filter = {
            status: { $nin: ["closed", "inactive"] } // Only active/pending accounts
        };

        // Filter by account_type if provided
        if (account_type) {
            filter.account_type = account_type;
        }

        // Determine the date to compare against
        let comparisonDate;
        if (date_of_maturity) {
            comparisonDate = new Date(date_of_maturity);
        } else {
            comparisonDate = new Date();
        }
        comparisonDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        // Pre-maturity: date_of_maturity >= today (future or present)
        filter.date_of_maturity = {
            $gte: comparisonDate,
            $ne: null // Exclude accounts without maturity date
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const accounts = await AccountsModel.find(filter)
            .sort({ date_of_maturity: 1 }) // Sort by nearest maturity date first
            .skip(skip)
            .limit(parseInt(limit));

        const totalAccounts = await AccountsModel.countDocuments(filter);

        // Fetch member details for each account
        const accountsWithMemberDetails = await Promise.all(
            accounts.map(async (account) => {
                const accountObj = account.toObject();

                if (accountObj.member_id) {
                    const member = await MemberModel.findOne(
                        { member_id: accountObj.member_id },
                        { name: 1, contactno: 1, emailid: 1, address: 1, _id: 0 }
                    );

                    if (member) {
                        accountObj.memberDetails = {
                            name: member.name,
                            contactno: member.contactno,
                            emailid: member.emailid,
                            address: member.address
                        };
                    }
                }

                // Fetch account group details
                if (accountObj.account_type) {
                    const accountGroup = await AccountGroupModel.findOne(
                        { account_group_id: accountObj.account_type },
                        { account_group_name: 1, _id: 0 }
                    );

                    if (accountGroup) {
                        accountObj.account_type_name = accountGroup.account_group_name;
                    }
                }

                return accountObj;
            })
        );

        res.status(200).json({
            success: true,
            message: "Pre-maturity accounts fetched successfully",
            data: accountsWithMemberDetails,
            pagination: {
                total: totalAccounts,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalAccounts / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching pre-maturity accounts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch pre-maturity accounts",
            error: error.message
        });
    }
};

// Get post-maturity accounts (date_of_maturity < today)
const getPostMaturityAccounts = async (req, res) => {
    try {
        const { account_type, date_of_maturity, page = 1, limit = 10 } = req.query;

        // Build filter object
        const filter = {
            status: { $nin: ["closed", "inactive"] } // Only active/pending accounts
        };

        // Filter by account_type if provided
        if (account_type) {
            filter.account_type = account_type;
        }

        // Determine the date to compare against
        let comparisonDate;
        if (date_of_maturity) {
            comparisonDate = new Date(date_of_maturity);
        } else {
            comparisonDate = new Date();
        }
        comparisonDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        // Post-maturity: date_of_maturity < today (past)
        filter.date_of_maturity = {
            $lt: comparisonDate,
            $ne: null // Exclude accounts without maturity date
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const accounts = await AccountsModel.find(filter)
            .sort({ date_of_maturity: -1 }) // Sort by most recent maturity date first
            .skip(skip)
            .limit(parseInt(limit));

        const totalAccounts = await AccountsModel.countDocuments(filter);

        // Fetch member details for each account
        const accountsWithMemberDetails = await Promise.all(
            accounts.map(async (account) => {
                const accountObj = account.toObject();

                if (accountObj.member_id) {
                    const member = await MemberModel.findOne(
                        { member_id: accountObj.member_id },
                        { name: 1, contactno: 1, emailid: 1, address: 1, _id: 0 }
                    );

                    if (member) {
                        accountObj.memberDetails = {
                            name: member.name,
                            contactno: member.contactno,
                            emailid: member.emailid,
                            address: member.address
                        };
                    }
                }

                // Fetch account group details
                if (accountObj.account_type) {
                    const accountGroup = await AccountGroupModel.findOne(
                        { account_group_id: accountObj.account_type },
                        { account_group_name: 1, _id: 0 }
                    );

                    if (accountGroup) {
                        accountObj.account_type_name = accountGroup.account_group_name;
                    }
                }

                return accountObj;
            })
        );

        res.status(200).json({
            success: true,
            message: "Post-maturity accounts fetched successfully",
            data: accountsWithMemberDetails,
            pagination: {
                total: totalAccounts,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalAccounts / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching post-maturity accounts:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch post-maturity accounts",
            error: error.message
        });
    }
};

// Get account transactions with optional account_type filter (for admin)
const getAccountTransactions = async (req, res) => {
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
        const TransactionModel = require("../../../models/transaction.model");
        const filter = { member_id: memberId };
        if (account_type) {
            filter.account_type = account_type;
        }

        // Find all transactions for this member (optionally filtered by account type)
        const transactions = await TransactionModel.find(filter)
            .sort({ transaction_date: -1 })
            .select('transaction_id transaction_date account_number account_type transaction_type description credit debit balance status reference_no');

        res.status(200).json({
            success: true,
            message: "Account transactions fetched successfully",
            data: transactions
        });
    } catch (error) {
        console.error("Error fetching account transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch account transactions",
            error: error.message
        });
    }
};

module.exports = {
    getInterestsByAccountGroup,
    createAccount,
    getAccounts,
    getAccountById,
    updateAccount,
    getAccountBooks,
    getAccountGroups,
    getPreMaturityAccounts,
    getPostMaturityAccounts,
    getAccountTransactions
};
