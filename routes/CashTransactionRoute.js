const express = require("express");
const router = express.Router();
const {
    getAllCashTransactions,
    getCashTransactionById,
    createCashTransaction,
    deleteCashTransaction,
    // createMaturityPayment
} = require("../controllers/Admin/Banking/cashTransaction");
const Authenticated = require("../middlewares/auth");
const authorizeRoles = require("../middlewares/authorizeRole");


router.get("/", Authenticated, authorizeRoles("ADMIN"), getAllCashTransactions);
router.get("/:id", Authenticated, authorizeRoles("ADMIN"), getCashTransactionById);
router.post("/", Authenticated, authorizeRoles("ADMIN"), createCashTransaction);
router.delete("/:id", Authenticated, authorizeRoles("ADMIN"), deleteCashTransaction);

// Route for creating maturity payments with Cashfree Payout


module.exports = router;
