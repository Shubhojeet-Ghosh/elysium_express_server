const bcrypt = require("bcrypt");

const ElysiumAtlasUser = require("../models/elysium_atlas_users");
const { generateJwtToken, verifyJwtToken } = require("./jwtService");
const { validateEmail } = require("./validateEmail");
const { sendHtmlEmail } = require("./emailSenderService");
const {
  generatePasswordResetEmail,
} = require("./atlasAuthEmailTemplateService");
const {
  PASSWORD_RESET_TOKEN_TYPE,
  PASSWORD_RESET_TTL_MINUTES,
  PASSWORD_RESET_TTL_JWT,
} = require("../constants/atlasPasswordResetConstants");

const ATLAS_FRONTEND_BASE_URL =
  process.env.ATLAS_FRONTEND_BASE_URL || "localhost:3000";

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists with this email, a password reset link has been sent.";

const buildResetLink = (token) =>
  `${ATLAS_FRONTEND_BASE_URL}/auth/reset-password?token=${token}`;

const buildResetToken = (user) =>
  generateJwtToken(
    {
      type: PASSWORD_RESET_TOKEN_TYPE,
      user_id: String(user._id),
      email: user.email,
    },
    PASSWORD_RESET_TTL_JWT,
  );

const verifyResetToken = (token) => {
  const decoded = verifyJwtToken(token);
  if (!decoded || decoded.type !== PASSWORD_RESET_TOKEN_TYPE) {
    return null;
  }
  return decoded;
};

/**
 * Sends a password-reset email when the user exists and has a completed profile.
 * Always returns the same success message (no email enumeration).
 */
const requestPasswordReset = async (email) => {
  if (!email || !validateEmail(email)) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: "A valid email is required.",
      },
    };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await ElysiumAtlasUser.findOne({ email: normalizedEmail });

  if (user?.is_profile_complete) {
    const resetToken = buildResetToken(user);
    const resetLink = buildResetLink(resetToken);
    const html = generatePasswordResetEmail({
      email: normalizedEmail,
      resetLink,
      expiresIn: PASSWORD_RESET_TTL_MINUTES,
    });

    await sendHtmlEmail({
      to: normalizedEmail,
      subject: "Reset your password - Elysium Atlas",
      html,
    });
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      message: GENERIC_FORGOT_PASSWORD_MESSAGE,
    },
  };
};

/**
 * Verifies the reset token and sets a new password for the user.
 */
const resetPassword = async ({ token, password }) => {
  if (!token) {
    return {
      statusCode: 400,
      body: { success: false, message: "Token is required." },
    };
  }

  const newPassword = typeof password === "string" ? password.trim() : "";
  if (!newPassword) {
    return {
      statusCode: 200,
      body: { success: false, message: "A valid password is required." },
    };
  }

  const decoded = verifyResetToken(token);
  if (!decoded) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: "Invalid or expired reset link.",
      },
    };
  }

  const user = await ElysiumAtlasUser.findById(decoded.user_id);
  if (!user || !user.is_profile_complete) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: "Invalid or expired reset link.",
      },
    };
  }

  if (user.email !== decoded.email?.toLowerCase()) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: "Invalid or expired reset link.",
      },
    };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await ElysiumAtlasUser.findByIdAndUpdate(user._id, {
    password: hashedPassword,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    },
  };
};

module.exports = {
  requestPasswordReset,
  resetPassword,
};
