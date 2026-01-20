const InterestModel = require("../../../models/interest.model");

// Create a new interest
const createInterest = async (req, res) => {
    try {
        const {
            plan_type,
            interest_name,
            duration,
            interest_rate_general,
            interest_rate_senior,
            minimum_deposit,
            from_date,
            to_date,
            status
        } = req.body;

        // Validate required fields
        if (!plan_type || !interest_name || duration === undefined ||
            interest_rate_general === undefined || interest_rate_senior === undefined) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: plan_type, interest_name, duration, interest_rate_general, and interest_rate_senior are required"
            });
        }

        // Validate plan_type enum
        const validPlanTypes = ["FD", "RD", "PIGMY", "SAVING"];
        if (!validPlanTypes.includes(plan_type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid plan_type. Must be one of: ${validPlanTypes.join(", ")}`
            });
        }

        // Auto-increment interest_id with INT prefix: Find max interest_id and add 1
        const lastInterest = await InterestModel.findOne()
            .sort({ interest_id: -1 })
            .limit(1);

        let newInterestId = "INT0001"; // Default starting ID
        if (lastInterest && lastInterest.interest_id) {
            // Extract numeric part from format "INTXXXX" and increment
            const numericPart = lastInterest.interest_id.replace(/^INT/, '');
            const lastId = parseInt(numericPart);
            if (!isNaN(lastId)) {
                const nextId = lastId + 1;
                // Format with INT prefix and pad to 4 digits
                newInterestId = `INT${nextId.toString().padStart(4, '0')}`;
            }
        }

        // Create new interest with auto-generated interest_id
        const newInterest = await InterestModel.create({
            interest_id: newInterestId,
            plan_type,
            interest_name,
            duration,
            interest_rate_general,
            interest_rate_senior,
            minimum_deposit: minimum_deposit || 0,
            from_date: from_date || new Date(),
            to_date: to_date || null,
            status: status || "active"
        });

        res.status(201).json({
            success: true,
            message: "Interest created successfully",
            data: newInterest
        });
    } catch (error) {
        console.error("Error creating interest:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create interest",
            error: error.message
        });
    }
};

// Get all interests
const getInterests = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;

        // Build filter object
        const filter = {};
        if (status) {
            filter.status = status;
        }
        if (search) {
            filter.$or = [
                { interest_id: { $regex: search, $options: "i" } },
                { interest_name: { $regex: search, $options: "i" } },
                { plan_type: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const interests = await InterestModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalInterests = await InterestModel.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "Interests fetched successfully",
            data: interests,
            pagination: {
                total: totalInterests,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalInterests / parseInt(limit))
            }
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

// Update an interest by ID
const updateInterest = async (req, res) => {
    try {
        const { interestId } = req.params;
        const updateData = req.body;

        // Find interest by interest_id
        const interest = await InterestModel.findOne({ interest_id: interestId });
        if (!interest) {
            return res.status(404).json({
                success: false,
                message: "Interest not found"
            });
        }

        // Update the interest
        const updatedInterest = await InterestModel.findOneAndUpdate(
            { interest_id: interestId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Interest updated successfully",
            data: updatedInterest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update interest",
            error: error.message
        });
    }
};

// Get a single interest by ID
const getInterestById = async (req, res) => {
    try {
        const { interestId } = req.params;

        // Use direct findOne instead of fetching all
        const interest = await InterestModel.findOne({
            $or: [
                { interest_id: interestId },
                { interest_id: interestId.toString() }
            ]
        });

        if (!interest) {
            return res.status(404).json({
                success: false,
                message: "Interest not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Interest fetched successfully",
            data: interest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch interest",
            error: error.message
        });
    }
};

module.exports = {
    createInterest,
    getInterests,
    updateInterest,
    getInterestById
};
