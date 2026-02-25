const { findOrCreateUserByEmail } = require("../services/atlasUserService");
const { generateJwtToken, verifyJwtToken } = require("../services/jwtService");
const { ensureTrialPlan } = require("../services/atlasUserPlanService");
const { ensureTeam } = require("../services/atlasTeamService");
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

      // Ensure the user has a personal team; create one if missing.
      const team = await ensureTeam(user._id, user.first_name, user.email);

      // Grant a 7-day trial to users who pre-date plan integration (fire-and-forget).
      ensureTrialPlan(
        user._id,
        "Auto-assigned 7-day trial on first login (pre-plan-integration account).",
      );

      // Generate session token for 30 days
      const sessionPayload = {
        user_id: user._id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_profile_complete: user.is_profile_complete,
        team_id: String(team._id),
        source: "elysium-atlas",
      };
      const sessionToken = generateJwtToken(sessionPayload, "30d");

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        is_profile_complete: user.is_profile_complete,
        sessionToken,
        user: {
          user_id: user._id,
          team_id: String(team._id),
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_image_url: user?.profile_image_url || null,
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

    // 1. Verify short-lived token using the service
    const decoded = verifyJwtToken(token);
    if (!decoded) {
      return res
        .status(200)
        .json({ success: false, message: "Invalid or expired token..." });
    }

    console.log("Decoded token : ", decoded);

    // 2. Find user
    const user = await ElysiumAtlasUser.findById(decoded.user_id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 3. Assign trial plan for new users, or for old users with no plan record (fire-and-forget).
    ensureTrialPlan(
      user._id,
      "Auto-assigned 7-day trial on magic-link verification.",
    );

    // 4. Ensure the user has a personal team; create one if missing.
    const team = await ensureTeam(user._id, user.first_name, user.email);

    // 5. Issue new session token (valid 30 days)
    const sessionPayload = {
      user_id: user._id,
      email: user.email,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      team_id: String(team._id),
    };
    const sessionToken = generateJwtToken(sessionPayload, "30d");

    // 6. Build response
    const response = {
      success: true,
      sessionToken,
      is_profile_complete: user.is_profile_complete,
      user: {
        user_id: user._id,
        team_id: String(team._id),
        email: user.email,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        profile_image_url: user?.profile_image_url || null,
      },
    };

    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateProfile = async (req, res) => {
  const user_id = req.user.user_id;
  const { first_name, last_name, password, profile_image_url, team_name } =
    req.body;

  try {
    // Build update object with only truthy values
    const updateData = {};

    // Only update first_name if it's present and truthy
    if (first_name && first_name.trim() !== "") {
      updateData.first_name = first_name.trim();
    }

    // Only update last_name if it's present and truthy
    if (
      last_name !== undefined &&
      last_name !== null &&
      last_name.trim() !== ""
    ) {
      updateData.last_name = last_name.trim();
    }

    // Only update password if it's present and truthy (not empty string or null)
    if (password && password !== "" && password !== null) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateData.password = hashedPassword;
    }

    // Only update profile_image_url if it's present and truthy
    if (
      profile_image_url !== undefined &&
      profile_image_url !== null &&
      profile_image_url !== ""
    ) {
      updateData.profile_image_url = profile_image_url;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({
        success: false,
        message: "No valid fields to update.",
      });
    }

    // If first_name is being updated, mark profile as complete
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
        .json({ success: false, message: "User not found." });
    }

    // Update team_name in atlas_teams if provided
    if (team_name?.trim()) {
      await AtlasTeam.findOneAndUpdate(
        { owner_user_id: String(user_id) },
        { team_name: team_name.trim() },
      );
    }

    // Fetch the user's personal team to include team_id in the token
    const userTeam = await AtlasTeam.findOne({
      owner_user_id: String(user_id),
    });

    // Create new session token with updated profile info
    const sessionPayload = {
      user_id: updatedUser._id,
      email: updatedUser.email,
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      is_profile_complete: updatedUser.is_profile_complete,
      team_id: userTeam ? String(userTeam._id) : null,
    };
    const sessionToken = generateJwtToken(sessionPayload, "30d");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      is_profile_complete: updatedUser.is_profile_complete,
      sessionToken,
      user: {
        user_id: updatedUser._id,
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
    const request_data = req.body;
    const access_token = request_data?.access_token;

    if (access_token == null || access_token == undefined) {
      return res.json({
        success: false,
        message: "Google access token is missing.",
      });
    }

    console.log("Access token received : ", access_token);

    const user = await getGoogleUserInfo(access_token);

    if (!user) {
      return res.json({
        success: false,
        message: "Invalid or expired Google token.",
      });
    }

    const { email, firstName, lastName, imageUrl } = user;

    const existingUser = await ElysiumAtlasUser.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      // Grant a 7-day trial to users who pre-date plan integration (fire-and-forget).
      ensureTrialPlan(
        existingUser._id,
        "Auto-assigned 7-day trial on first Google login (pre-plan-integration account).",
      );

      // Ensure the user has a personal team; create one if missing.
      const existingUserTeam = await ensureTeam(
        existingUser._id,
        existingUser.first_name,
        existingUser.email,
      );

      const sessionPayload = {
        user_id: existingUser._id,
        email: existingUser.email,
        first_name: existingUser.first_name,
        last_name: existingUser.last_name,
        is_profile_complete: existingUser.is_profile_complete,
        team_id: String(existingUserTeam._id),
      };
      const sessionToken = generateJwtToken(sessionPayload, "30d");

      return res.json({
        success: true,
        message: "User verified.",
        is_profile_complete: existingUser.is_profile_complete,
        user: {
          user_id: existingUser._id,
          team_id: String(existingUserTeam._id),
          email: existingUser.email,
          first_name: existingUser.first_name,
          last_name: existingUser.last_name,
          profile_image_url: existingUser?.profile_image_url || null,
        },
        sessionToken,
      });
    } else {
      const newUser = await ElysiumAtlasUser.create({
        email,
        first_name: firstName,
        last_name: lastName,
        profile_image_url: imageUrl,
      });

      // New Google sign-up — assign 7-day trial immediately (fire-and-forget).
      ensureTrialPlan(
        newUser._id,
        "Auto-assigned 7-day trial on new Google sign-up.",
      );

      // Create the user's personal team on sign-up.
      const newUserTeam = await ensureTeam(
        newUser._id,
        newUser.first_name,
        newUser.email,
      );

      const sessionPayload = {
        user_id: newUser._id,
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        is_profile_complete: false,
        team_id: String(newUserTeam._id),
      };
      const sessionToken = generateJwtToken(sessionPayload, "30d");
      return res.json({
        success: true,
        message: "User verified.",
        is_profile_complete: false,
        user: {
          user_id: newUser._id,
          team_id: String(newUserTeam._id),
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          profile_image_url: newUser?.profile_image_url || null,
        },
        sessionToken,
      });
    }

    return res.json({
      success: true,
      message: "User verified.",
      user: user,
    });
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
  updateProfile,
  verifyGoogleLogin,
};
