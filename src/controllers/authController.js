const { findOrCreateUserByEmail } = require("../services/userService");

const sendMagicLink = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  }

  try {
    const { created, user } = await findOrCreateUserByEmail(email);
    // Logic to generate & send magic link goes here...

    return res.status(200).json({
      success: true,
      message: "Magic link sent to your email.",
      createdNewUser: created,
      user_id: user._id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { sendMagicLink };
