// Import libraries here
const express = require("express");
const router = express.Router();
const auth = require("../../helpers/auth");

// Load Controllers
const { paytmController } = require("../controllers/paytm.controller");
const { callbackController } = require("../controllers/callback.controller");

// Routes here
router.post("/payment", auth, paytmController);
router.post("/callback", callbackController);
// router.get("/transaction", auth, transactionController);

module.exports = router;