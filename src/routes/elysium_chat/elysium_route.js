const express = require("express");
const router = express.Router();

const elysiumChatController = require("../../controllers/elysium_chat_controllers/elysiumChatController");

const { authenticateToken } = require("../../middlewares/authMiddleware");

router.post(
  "/fetch-user-by-email",
  authenticateToken,
  elysiumChatController.getUserByEmail
);

module.exports = router;
