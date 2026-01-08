const PaymentsModel = require("../../../models/payments.model.js");

// Create a new payment
const createPayment = async (req, res) => {
    try {
        const {
            payment_date,
            paid_to,
            payment_details,
            mode_of_payment_paid,
            amount,
            status,
            ref_no,
            payment_no,
            entered_by,
            branch_code,
            member_id,
            account_details
        } = req.body;

        // Auto-increment payment_id with PMT prefix
        const lastPayment = await PaymentsModel.findOne()
            .sort({ payment_id: -1 })
            .limit(1);

        let newPaymentId = "PMT0001"; // Default starting ID
        if (lastPayment && lastPayment.payment_id) {
            // Extract numeric part from format "PMTXXXX" and increment
            const numericPart = lastPayment.payment_id.replace(/^PMT/, '');
            const lastId = parseInt(numericPart);
            if (!isNaN(lastId)) {
                const nextId = lastId + 1;
                // Format with PMT prefix and pad to 4 digits
                newPaymentId = `PMT${nextId.toString().padStart(4, '0')}`;
            }
        }

        // Create new payment with auto-generated payment_id
        const newPayment = await PaymentsModel.create({
            payment_id: newPaymentId,
            payment_date,
            paid_to,
            payment_details,
            mode_of_payment_paid,
            amount,
            status: status || "active",
            ref_no,
            payment_no,
            entered_by,
            branch_code,
            member_id,
            account_details
        });

        res.status(201).json({
            success: true,
            message: "Payment created successfully",
            data: newPayment
        });
    } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create payment",
            error: error.message
        });
    }
};

// Get all payments with pagination and filtering
const getPayments = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, branch_code } = req.query;

        // Build filter object - exclude inactive records by default
        const filter = { status: { $ne: 'inactive' } };
        if (status) {
            filter.status = status;
        }
        if (branch_code) {
            filter.branch_code = branch_code;
        }
        if (search) {
            filter.$or = [
                { payment_id: { $regex: search, $options: "i" } },
                { payment_details: { $regex: search, $options: "i" } },
                { paid_to: { $regex: search, $options: "i" } },
                { member_id: { $regex: search, $options: "i" } },
                { "account_details.account_no": { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const payments = await PaymentsModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalPayments = await PaymentsModel.countDocuments(filter);

        res.status(200).json({
            success: true,
            message: "Payments fetched successfully",
            data: payments,
            pagination: {
                total: totalPayments,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalPayments / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payments",
            error: error.message
        });
    }
};

// Get a single payment by ID
const getPaymentById = async (req, res) => {
    try {
        const { paymentId } = req.params;

        // Exclude inactive records
        const allPayments = await PaymentsModel.find({ status: { $ne: 'inactive' } });
        const payment = allPayments.find(p => p.payment_id === paymentId);

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Payment fetched successfully",
            data: payment
        });
    } catch (error) {
        console.error("Error fetching payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch payment",
            error: error.message
        });
    }
};

// Update a payment by ID
const updatePayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const updateData = req.body;

        // Find payment by payment_id
        const payment = await PaymentsModel.findOne({ payment_id: paymentId });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        // Update the payment
        const updatedPayment = await PaymentsModel.findOneAndUpdate(
            { payment_id: paymentId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Payment updated successfully",
            data: updatedPayment
        });
    } catch (error) {
        console.error("Error updating payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update payment",
            error: error.message
        });
    }
};

// Delete a payment by ID (soft delete - update status to inactive)
const deletePayment = async (req, res) => {
    try {
        const { paymentId } = req.params;

        const payment = await PaymentsModel.findOne({ payment_id: paymentId });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        // Soft delete by updating status
        const deletedPayment = await PaymentsModel.findOneAndUpdate(
            { payment_id: paymentId },
            { $set: { status: "inactive" } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Payment deleted successfully",
            data: deletedPayment
        });
    } catch (error) {
        console.error("Error deleting payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete payment",
            error: error.message
        });
    }
};

module.exports = {
    createPayment,
    getPayments,
    getPaymentById,
    updatePayment,
    deletePayment
};
