// Vercel API Route for Cashfree Webhook
// This file is specifically designed for Vercel's serverless architecture
// Path: /api/transaction/webhook/cashfree

const crypto = require("crypto");

// ⚠️ CRITICAL: Disable body parser to get raw body for signature verification
module.exports.config = {
    api: {
        bodyParser: false, // Required for raw body access
    },
};

module.exports = async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        // Read raw body from request
        let rawBody = "";
        await new Promise((resolve) => {
            req.on("data", (chunk) => {
                rawBody += chunk.toString("utf8");
            });
            req.on("end", resolve);
        });

        console.log("🟢 CASHFREE WEBHOOK RECEIVED (Vercel API Route) =====================");
        console.log("📤 Raw Body Length:", rawBody.length);
        console.log("🏷️ Headers:", JSON.stringify(req.headers, null, 2));

        // Get signature and timestamp from headers
        const signature = req.headers["x-webhook-signature"];
        const timestamp = req.headers["x-webhook-timestamp"];
        const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;

        console.log("🔑 Signature from header:", signature);
        console.log("⏰ Timestamp from header:", timestamp);
        console.log("🔐 Webhook secret configured:", !!webhookSecret);

        // Verify signature if all components are present
        if (signature && timestamp && rawBody && webhookSecret) {
            // Cashfree signature = HMAC-SHA256(timestamp + rawBody, secret)
            const signatureData = timestamp + rawBody;
            const expectedSignature = crypto
                .createHmac("sha256", webhookSecret)
                .update(signatureData)
                .digest("base64");

            if (expectedSignature !== signature) {
                console.error("❌ INVALID SIGNATURE");
                console.log("Expected:", expectedSignature);
                console.log("Received:", signature);
                return res.status(400).json({ error: "Invalid signature" });
            } else {
                console.log("✅ Signature verified successfully");
            }
        } else {
            console.log("⚠️ Missing signature components, skipping verification");
            console.log("  - Signature:", signature ? "✓" : "✗");
            console.log("  - Timestamp:", timestamp ? "✓" : "✗");
            console.log("  - RawBody:", rawBody ? "✓" : "✗");
            console.log("  - Secret:", webhookSecret ? "✓" : "✗");

            // In production, we should enforce signature verification
            if (process.env.NODE_ENV === "production") {
                return res.status(400).json({ error: "Missing signature components" });
            }
        }

        // Parse webhook data
        const webhookData = JSON.parse(rawBody);
        console.log("📋 Webhook Event:", webhookData.type);

        // Extract order ID
        const orderId = webhookData.data?.order?.order_id;
        if (!orderId) {
            console.warn("❌ No order ID in webhook");
            return res.status(200).json({ received: true });
        }

        console.log("🔍 Order ID:", orderId);

        // Import models (CommonJS require)
        const connectDB = require("../../../models/db");
        const TransactionModel = require("../../../models/transaction.model");
        const AccountsModel = require("../../../models/accounts.model");

        // Ensure database connection
        await connectDB();

        const start = Date.now();

        // Atomically mark transaction as being processed
        const transaction = await TransactionModel.findOneAndUpdate(
            {
                transaction_id: orderId,
                webhook_processed: { $ne: true },
            },
            {
                $set: {
                    webhook_processed: true,
                    webhook_processed_at: new Date(),
                },
            },
            { new: true }
        );

        if (!transaction) {
            // Either transaction doesn't exist OR already processed
            const existingTx = await TransactionModel.findOne({ transaction_id: orderId });
            if (existingTx) {
                console.log("⚠️ Already processed (duplicate webhook):", orderId);
            } else {
                console.warn("❌ Transaction not found:", orderId);
            }
            return res.status(200).json({ received: true });
        }

        console.log("✅ Webhook processing started for:", orderId);

        // Process based on event type
        if (webhookData.type === "PAYMENT_SUCCESS_WEBHOOK") {
            console.log("💰 Processing successful payment...");

            // Atomic status update - only process if still Pending
            const statusUpdate = await TransactionModel.findOneAndUpdate(
                {
                    transaction_id: orderId,
                    status: "Pending",
                },
                {
                    $set: {
                        status: "Completed",
                        payment_status: "Success",
                        payment_completed_at: new Date(),
                        webhook_processed: true,
                        webhook_processed_at: new Date(),
                    },
                },
                { new: false }
            );

            if (!statusUpdate || statusUpdate.status !== "Pending") {
                console.log("⚠️ Transaction already completed (duplicate SUCCESS webhook):", orderId);
                return res.status(200).json({ received: true });
            }

            console.log("✅ First SUCCESS webhook - proceeding with balance update");

            // Amount verification
            const paymentData = webhookData.data?.payment;
            if (paymentData) {
                const receivedAmount = parseFloat(paymentData.payment_amount);
                const expectedAmount = parseFloat(transaction.credit);

                if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
                    console.error("❌ Amount mismatch!");

                    transaction.status = "Failed";
                    transaction.payment_status = "Failed";
                    transaction.description = `Amount mismatch: ₹${receivedAmount} vs ₹${expectedAmount}`;
                    transaction.payment_failed_at = new Date();
                    await transaction.save();

                    return res.status(200).json({ received: true });
                }
            }

            // Update account balance
            if (transaction.account_number && transaction.account_type) {
                const allAccounts = await AccountsModel.find({});
                const account = allAccounts.find(
                    (acc) =>
                        acc.member_id == transaction.member_id &&
                        acc.account_no == transaction.account_number &&
                        acc.account_type === transaction.account_type &&
                        acc.status === "active"
                );

                if (account) {
                    const newBalance = account.account_amount + parseFloat(transaction.credit);
                    account.account_amount = newBalance;
                    await account.save();

                    transaction.balance = newBalance;
                    console.log(`✅ Account ${account.account_no} credited: ₹${transaction.credit}`);

                    // Calculate total balance across all accounts
                    const allMemberAccounts = allAccounts.filter(
                        (acc) => acc.member_id == transaction.member_id
                    );
                    const totalBalance = allMemberAccounts.reduce(
                        (sum, acc) => sum + (acc.account_amount || 0),
                        0
                    );
                    console.log(
                        `💰 Member ${transaction.member_id} total balance across all accounts: ₹${totalBalance}`
                    );
                }
            }

            // Store payment details
            if (paymentData) {
                transaction.payment_details = {
                    payment_method:
                        typeof paymentData.payment_method === "string"
                            ? paymentData.payment_method
                            : JSON.stringify(paymentData.payment_method),
                    bank_reference: paymentData.bank_reference,
                    payment_time: paymentData.payment_time,
                    payment_amount: paymentData.payment_amount,
                    gateway_payment_id: paymentData.cf_payment_id,
                };
            }

            transaction.payment_data = webhookData.data;
            await transaction.save();

            // Process commission after successful transaction
            try {
                const { processTransactionCommission } = require("../../../utils/commissionUtils");
                const commissionResult = await processTransactionCommission(transaction);

                if (commissionResult.success) {
                    console.log(
                        `✅ Commission processed: ${commissionResult.results?.successful?.length || 0} successful`
                    );
                } else {
                    console.warn(`⚠️ Commission processing issue: ${commissionResult.message}`);
                }
            } catch (commError) {
                console.error("Commission processing error:", commError.message);
                // Don't fail webhook if commission fails
            }

            console.log(`✅ Payment completed in ${Date.now() - start}ms`);
        } else if (webhookData.type === "PAYMENT_FAILED_WEBHOOK") {
            console.log("❌ Processing failed payment...");

            const paymentData = webhookData.data?.payment;
            const failureReason = paymentData?.payment_message || "Unknown failure reason";

            transaction.status = "Failed";
            transaction.payment_status = "Failed";
            transaction.payment_failed_at = new Date();
            transaction.payment_data = webhookData.data;
            transaction.description = `Payment Failed: ${failureReason}`;

            console.log("💔 Failure Reason:", failureReason);
            if (paymentData) {
                console.log("🚫 Payment Details:", {
                    payment_message: paymentData.payment_message,
                    bank_reference: paymentData.bank_reference,
                    payment_method: paymentData.payment_method,
                });
            }

            await transaction.save();

            console.log(`✅ Failed payment processed in ${Date.now() - start}ms`);
        } else {
            // For other events, just acknowledge
            console.log("ℹ️ Other webhook event:", webhookData.type);
            await transaction.save();
        }

        console.log("🔚 WEBHOOK PROCESSING COMPLETED\n");
        return res.status(200).json({ received: true });
    } catch (error) {
        console.error("❌ WEBHOOK ERROR:", error.message);
        console.error("Stack:", error.stack);
        // Always return 200 to prevent Cashfree from retrying
        return res.status(200).json({ received: true, error: error.message });
    }
};
