const { findOrCreateUserByEmail } = require("../services/userService");
const { generateJwtToken, verifyJwtToken } = require("../services/jwtService");
const { generateMagicLinkEmail } = require("../services/emailTemplateService");
const { sendHtmlEmail } = require("../services/emailSenderService");
const { validateEmail } = require("../services/validateEmail");
const User = require("../models/users");

const bcrypt = require("bcrypt");

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "localhost:3000";

const sendMagicLinkOrLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(200).json({
      success: false,
      message: "A valid email is required.",
    });
  }

  try {
    // ----- CASE 1: Password Provided (Email & Password Login) -----
    if (password) {
      const user = await User.findOne({ email: email.toLowerCase().trim() });

      if (!user || !user.is_profile_complete) {
        return res
          .status(200)
          .json({ success: false, message: "This email is not registered." });
      }

      const isMatch = await bcrypt.compare(password, user.password || "");
      if (!isMatch) {
        return res
          .status(200)
          .json({ success: false, message: "Invalid Password." });
      }

      // Generate session token for 30 days
      const sessionPayload = {
        user_id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_profile_complete: user.is_profile_complete,
      };
      const sessionToken = generateJwtToken(sessionPayload, "30d");

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        is_profile_complete: user.is_profile_complete,
        sessionToken,
        user: {
          user_id: user._id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
      });
    }

    // ----- CASE 2: Password Not Provided (Magic Link) -----
    const { created, user } = await findOrCreateUserByEmail(email);

    const tokenPayload = {
      user_id: user._id,
      email: user.email,
    };
    const magicToken = generateJwtToken(tokenPayload, "5m");
    const magicLink = `${FRONTEND_BASE_URL}/elysium-chat/auth/verify?token=${magicToken}`;
    const html = generateMagicLinkEmail({
      email,
      magicLink,
      expiresIn: 5,
    });

    sendHtmlEmail({
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

const verifyMagicLink = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Token is required" });
    }

    // 1. Verify short-lived token using the service
    const decoded = verifyJwtToken(token);
    if (!decoded) {
      return res
        .status(200)
        .json({ success: false, message: "Invalid or expired token..." });
    }

    // 2. Find user
    const user = await User.findById(decoded.user_id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 3. Issue new session token (valid 30 days)
    const sessionPayload = {
      user_id: user._id,
      email: user.email,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
    };
    const sessionToken = generateJwtToken(sessionPayload, "30d");

    // 4. Build response
    const response = {
      success: true,
      sessionToken,
      is_profile_complete: user.is_profile_complete,
      user: {
        user_id: user._id,
        email: user.email,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
      },
    };

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const completeProfile = async (req, res) => {
  const user_id = req.user.user_id;
  const { first_name, last_name, password } = req.body;

  if (!first_name || !password) {
    return res.status(200).json({
      success: false,
      message: "Please fill in all the fields.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const updatedUser = await User.findByIdAndUpdate(
      user_id,
      {
        first_name,
        last_name: last_name || "",
        password: hashedPassword,
        is_profile_complete: true,
      },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Create new session token with updated profile info
    const sessionPayload = {
      user_id: updatedUser._id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      is_profile_complete: true,
    };
    const sessionToken = generateJwtToken(sessionPayload, "30d");

    return res.status(200).json({
      success: true,
      message: "Profile completed successfully.",
      is_profile_complete: true,
      sessionToken,
      user: {
        user_id: updatedUser._id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { sendMagicLinkOrLogin, verifyMagicLink, completeProfile };
