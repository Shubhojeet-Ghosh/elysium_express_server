const express = require("express");
const router = express.Router();

const sgdevstudioController = require("../../controllers/portfolio_controllers/sgdevstudioControllers");

router.post("/contact-submission", sgdevstudioController.contactSubmission);

router.post(
  "/register-visitor",
  sgdevstudioController.registerVisitorController
);

module.exports = router;
