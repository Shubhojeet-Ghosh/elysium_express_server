const { findOrCreateUserByEmail } = require("../services/userService");
const { generateJwtToken } = require("../services/jwtService");
const { generateMagicLinkEmail } = require("../services/emailTemplateService");
const { sendHtmlEmail } = require("../services/emailSenderService");

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "localhost:3000";

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

    const tokenPayload = {
      user_id: user._id,
      email: user.email,
      // You can add more fields if needed (e.g., first_name, roles, etc.)
    };

    const magicToken = generateJwtToken(tokenPayload, "5m");

    // 3. Build the magic link
    const magicLink = `${FRONTEND_BASE_URL}/elysium-chat/auth/verify?token=${magicToken}`;

    // 4. Generate the HTML email
    const html = generateMagicLinkEmail({
      email,
      magicLink,
      expiresIn: 5,
    });

    // 5. Send the email
    await sendHtmlEmail({
      to: email,
      subject: "Your Magic Login Link - Elysium Chat",
      html,
    });

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
