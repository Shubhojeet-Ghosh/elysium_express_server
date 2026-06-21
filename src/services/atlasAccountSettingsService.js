const bcrypt = require("bcrypt");

const ElysiumAtlasUser = require("../models/elysium_atlas_users");
const AtlasTeam = require("../models/atlas_teams");
const { generateJwtToken } = require("./jwtService");
const { resolveTeamAccess } = require("./atlasTeamPermissionService");
const { TEAM_OWNER_ROLE } = require("../constants/atlasTeamRoleConstants");

const hasField = (body, key) =>
  Object.prototype.hasOwnProperty.call(body, key);

const trimString = (value) =>
  typeof value === "string" ? value.trim() : value;

/**
 * Updates account settings for the team owner only.
 * Supports partial updates: first_name, last_name, team_name, password.
 * Password changes require current_password to match.
 */
const updateAccountSettings = async ({
  userId,
  teamId,
  body,
}) => {
  const access = await resolveTeamAccess(userId, teamId);

  if (!access.ok) {
    return {
      statusCode: access.statusCode,
      body: { success: false, message: access.message },
    };
  }

  if (
    access.role !== TEAM_OWNER_ROLE ||
    String(access.ownerUserId) !== String(userId)
  ) {
    return {
      statusCode: 403,
      body: {
        success: false,
        message: "Only the team owner can update account settings.",
      },
    };
  }

  const userUpdate = {};
  let teamNameUpdate = null;

  if (hasField(body, "first_name")) {
    const firstName = trimString(body.first_name);
    if (!firstName) {
      return {
        statusCode: 200,
        body: {
          success: false,
          message: "first_name cannot be empty.",
        },
      };
    }
    userUpdate.first_name = firstName;
  }

  if (hasField(body, "last_name")) {
    const lastName = trimString(body.last_name);
    if (!lastName) {
      return {
        statusCode: 200,
        body: {
          success: false,
          message: "last_name cannot be empty.",
        },
      };
    }
    userUpdate.last_name = lastName;
  }

  if (hasField(body, "team_name")) {
    const teamName = trimString(body.team_name);
    if (!teamName) {
      return {
        statusCode: 200,
        body: {
          success: false,
          message: "team_name cannot be empty.",
        },
      };
    }
    teamNameUpdate = teamName;
  }

  const wantsPasswordChange = hasField(body, "password");
  const hasCurrentPassword = hasField(body, "current_password");

  if (wantsPasswordChange || hasCurrentPassword) {
    const newPassword = trimString(body.password);
    const currentPassword = body.current_password;

    if (!wantsPasswordChange || !newPassword) {
      return {
        statusCode: 200,
        body: {
          success: false,
          message: "password is required when changing your password.",
        },
      };
    }

    if (!hasCurrentPassword || currentPassword == null || currentPassword === "") {
      return {
        statusCode: 200,
        body: {
          success: false,
          message: "current_password is required to change your password.",
        },
      };
    }

    const user = await ElysiumAtlasUser.findById(userId).select("password");
    if (!user) {
      return {
        statusCode: 404,
        body: { success: false, message: "User not found." },
      };
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password || "",
    );
    if (!isMatch) {
      return {
        statusCode: 200,
        body: {
          success: false,
          message: "Current password is incorrect.",
        },
      };
    }

    userUpdate.password = await bcrypt.hash(newPassword, 12);
  }

  if (
    Object.keys(userUpdate).length === 0 &&
    teamNameUpdate === null
  ) {
    return {
      statusCode: 200,
      body: {
        success: false,
        message: "No valid fields to update.",
      },
    };
  }

  let updatedUser = null;

  if (Object.keys(userUpdate).length > 0) {
    if (userUpdate.first_name) {
      userUpdate.is_profile_complete = true;
    }

    updatedUser = await ElysiumAtlasUser.findByIdAndUpdate(userId, userUpdate, {
      new: true,
    });

    if (!updatedUser) {
      return {
        statusCode: 404,
        body: { success: false, message: "User not found." },
      };
    }
  } else {
    updatedUser = await ElysiumAtlasUser.findById(userId);
    if (!updatedUser) {
      return {
        statusCode: 404,
        body: { success: false, message: "User not found." },
      };
    }
  }

  let updatedTeam = access.team;

  if (teamNameUpdate !== null) {
    updatedTeam = await AtlasTeam.findByIdAndUpdate(
      teamId,
      { team_name: teamNameUpdate },
      { new: true },
    ).lean();

    if (!updatedTeam) {
      return {
        statusCode: 404,
        body: { success: false, message: "Team not found." },
      };
    }
  }

  const sessionPayload = {
    user_id: updatedUser._id,
    email: updatedUser.email,
    first_name: updatedUser.first_name,
    last_name: updatedUser.last_name,
    is_profile_complete: updatedUser.is_profile_complete,
    team_id: String(teamId),
    role: TEAM_OWNER_ROLE,
  };
  const sessionToken = generateJwtToken(sessionPayload, "30d");

  return {
    statusCode: 200,
    body: {
      success: true,
      message: "Account settings updated successfully.",
      sessionToken,
      user: {
        user_id: updatedUser._id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        profile_image_url: updatedUser.profile_image_url || null,
        team_id: String(teamId),
        team_name: updatedTeam?.team_name || null,
        role: TEAM_OWNER_ROLE,
      },
    },
  };
};

module.exports = {
  updateAccountSettings,
};
