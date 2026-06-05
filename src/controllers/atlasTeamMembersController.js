const {
  inviteTeamMembers,
  getInvitationPreview,
  respondToInvitation,
  listTeamMembers,
} = require("../services/atlasTeamMemberService");
const { DEFAULT_MEMBER_ROLE } = require("../constants/atlasTeamInviteConstants");

const inviteMembers = async (req, res) => {
  try {
    const { emails, role } = req.body;

    const result = await inviteTeamMembers({
      ownerUserId: req.user.user_id,
      ownerEmail: req.user.email,
      teamId: req.user.team_id,
      emails,
      role: role || DEFAULT_MEMBER_ROLE,
    });

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const previewInvitation = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required.",
      });
    }

    const result = await getInvitationPreview(token);
    return res.status(200).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const respondInvitation = async (req, res) => {
  try {
    const { token, accept } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required.",
      });
    }

    const result = await respondToInvitation({ token, accept });
    return res.status(200).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const listMembers = async (req, res) => {
  try {
    const result = await listTeamMembers({
      ownerUserId: req.user.user_id,
      teamId: req.user.team_id,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status || "active",
    });

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  inviteMembers,
  previewInvitation,
  respondInvitation,
  listMembers,
};
