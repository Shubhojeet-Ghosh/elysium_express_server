const {
  requestPasswordReset,
  resetPassword,
} = require("../services/atlasPasswordResetService");

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await requestPasswordReset(email);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const resetPasswordHandler = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    const { password } = req.body;
    const result = await resetPassword({ token, password });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  forgotPassword,
  resetPassword: resetPasswordHandler,
};
