const { findOrCreateUserByEmail } = require("../services/atlasUserService");
const {
  generateJwtToken,
  verifyJwtToken,
  inspectJwtToken,
} = require("../services/jwtService");
const { ensureTrialPlan } = require("../services/atlasUserPlanService");
const { ensureTeam, getUserRoleForTeam } = require("../services/atlasTeamService");
const {
  buildPostAuthResponse,
  selectTeamAndIssueSession,
} = require("../services/atlasAuthSessionService");
const {
  generateMagicLinkEmail,
} = require("../services/atlasAuthEmailTemplateService");
const { sendHtmlEmail } = require("../services/emailSenderService");
const { validateEmail } = require("../services/validateEmail");
const { getGoogleUserInfo } = require("../services/googleAuthService");

const ElysiumAtlasUser = require("../models/elysium_atlas_users");
const AtlasTeam = require("../models/atlas_teams");

const bcrypt = require("bcrypt");

const ATLAS_FRONTEND_BASE_URL =
  process.env.ATLAS_FRONTEND_BASE_URL || "localhost:3000";

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
      const user = await ElysiumAtlasUser.findOne({
        email: email.toLowerCase().trim(),
      });

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

      await ensureTeam(user._id, user.first_name, user.email);

      ensureTrialPlan(
        user._id,
        "Auto-assigned 7-day trial on first login (pre-plan-integration account).",
      );

      const result = await buildPostAuthResponse(user, {
        message: "Login successful.",
        source: "elysium-atlas",
      });

      return res.status(result.statusCode).json(result.body);
    }

    // ----- CASE 2: Password Not Provided (Magic Link) -----
    const { created, user } = await findOrCreateUserByEmail(email);

    const tokenPayload = {
      user_id: user._id,
      email: user.email,
    };
    const magicToken = generateJwtToken(tokenPayload, "5m");
    const magicLink = `${ATLAS_FRONTEND_BASE_URL}/auth/verify?token=${magicToken}`;
    const html = generateMagicLinkEmail({
      email,
      magicLink,
      expiresIn: 5,
    });

    sendHtmlEmail({
      to: email,
      subject: "Your Magic Login Link - Elysium Atlas",
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

    const decoded = verifyJwtToken(token);
    if (!decoded) {
      return res
        .status(200)
        .json({ success: false, message: "Invalid or expired token..." });
    }

    const user = await ElysiumAtlasUser.findById(decoded.user_id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    ensureTrialPlan(
      user._id,
      "Auto-assigned 7-day trial on magic-link verification.",
    );

    await ensureTeam(user._id, user.first_name, user.email);

    const result = await buildPostAuthResponse(user, {
      message: "Login successful.",
    });

    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const selectTeam = async (req, res) => {
  try {
    const { selection_token, team_id } = req.body;
    const result = await selectTeamAndIssueSession(selection_token, team_id);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const decodeToken = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    const result = inspectJwtToken(token);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const updateProfile = async (req, res) => {
  const user_id = req.user.user_id;
  const { first_name, last_name, password, profile_image_url, team_name } =
    req.body;

  try {
    const updateData = {};

    if (first_name && first_name.trim() !== "") {
      updateData.first_name = first_name.trim();
    }

    if (
      last_name !== undefined &&
      last_name !== null &&
      last_name.trim() !== ""
    ) {
      updateData.last_name = last_name.trim();
    }

    if (password && password !== "" && password !== null) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateData.password = hashedPassword;
    }

    if (
      profile_image_url !== undefined &&
      profile_image_url !== null &&
      profile_image_url !== ""
    ) {
      updateData.profile_image_url = profile_image_url;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({
        success: false,
        message: "No valid fields to update.",
      });
    }

    if (updateData.first_name) {
      updateData.is_profile_complete = true;
    }

    const updatedUser = await ElysiumAtlasUser.findByIdAndUpdate(
      user_id,
      updateData,
      { new: true },
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (team_name?.trim()) {
      await AtlasTeam.findOneAndUpdate(
        { owner_user_id: String(user_id) },
        { team_name: team_name.trim() },
      );
    }

    const activeTeamId = req.user.team_id || null;
    const role = activeTeamId
      ? await getUserRoleForTeam(user_id, activeTeamId)
      : null;

    const sessionPayload = {
      user_id: updatedUser._id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      is_profile_complete: updatedUser.is_profile_complete,
      team_id: activeTeamId ? String(activeTeamId) : null,
      role,
    };
    const sessionToken = generateJwtToken(sessionPayload, "30d");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      is_profile_complete: updatedUser.is_profile_complete,
      sessionToken,
      user: {
        user_id: updatedUser._id,
        team_id: activeTeamId ? String(activeTeamId) : null,
        role,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        profile_image_url: updatedUser?.profile_image_url || null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const verifyGoogleLogin = async (req, res) => {
  try {
    const access_token = req.body?.access_token;

    if (access_token == null || access_token == undefined) {
      return res.json({
        success: false,
        message: "Google access token is missing.",
      });
    }

    const googleUser = await getGoogleUserInfo(access_token);

    if (!googleUser) {
      return res.json({
        success: false,
        message: "Invalid or expired Google token.",
      });
    }

    const { email, firstName, lastName, imageUrl } = googleUser;

    let user = await ElysiumAtlasUser.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      user = await ElysiumAtlasUser.create({
        email,
        first_name: firstName,
        last_name: lastName,
        profile_image_url: imageUrl,
      });

      ensureTrialPlan(
        user._id,
        "Auto-assigned 7-day trial on new Google sign-up.",
      );
    } else {
      ensureTrialPlan(
        user._id,
        "Auto-assigned 7-day trial on first Google login (pre-plan-integration account).",
      );
    }

    await ensureTeam(user._id, user.first_name, user.email);

    const result = await buildPostAuthResponse(user, {
      message: "User verified.",
    });

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.log("Something went wrong : ", error);
    return res.json({
      success: false,
      message: "Something went wrong.",
    });
  }
};

module.exports = {
  sendMagicLinkOrLogin,
  verifyMagicLink,
  selectTeam,
  decodeToken,
  updateProfile,
  verifyGoogleLogin,
};
