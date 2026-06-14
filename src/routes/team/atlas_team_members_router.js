const express = require("express");
const router = express.Router();

const atlasTeamMembersController = require("../../controllers/atlasTeamMembersController");
const { authenticateToken } = require("../../middlewares/authMiddleware");

router.post(
  "/v1/team/members/invite",
  authenticateToken,
  atlasTeamMembersController.inviteMembers,
);

router.post(
  "/v1/team/members/invitation/preview",
  atlasTeamMembersController.previewInvitation,
);

router.post(
  "/v1/team/members/invitation/respond",
  atlasTeamMembersController.respondInvitation,
);

router.get(
  "/v1/team/members",
  authenticateToken,
  atlasTeamMembersController.listMembers,
);

router.post(
  "/v1/team/members/remove",
  authenticateToken,
  atlasTeamMembersController.removeMember,
);

router.post(
  "/v1/team/members/update-role",
  authenticateToken,
  atlasTeamMembersController.updateMemberRole,
);

module.exports = router;
