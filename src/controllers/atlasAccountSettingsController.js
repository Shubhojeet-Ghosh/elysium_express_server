const {
  updateAccountSettings,
} = require("../services/atlasAccountSettingsService");

const updateSettings = async (req, res) => {
  try {
    const result = await updateAccountSettings({
      userId: req.user.user_id,
      teamId: req.user.team_id,
      body: req.body,
    });

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  updateSettings,
};
