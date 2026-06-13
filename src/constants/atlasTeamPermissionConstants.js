const {
  TEAM_OWNER_ROLE,
  TEAM_ADMIN_ROLE,
  TEAM_MEMBER_ROLE,
} = require("./atlasTeamRoleConstants");

/** Extend this map when adding new team-scoped actions. */
const TEAM_ACTIONS = {
  LIST_MEMBERS: "list_members",
  INVITE_MEMBERS: "invite_members",
  REMOVE_MEMBERS: "remove_members",
};

const ROLE_PERMISSIONS = {
  [TEAM_OWNER_ROLE]: [
    TEAM_ACTIONS.LIST_MEMBERS,
    TEAM_ACTIONS.INVITE_MEMBERS,
    TEAM_ACTIONS.REMOVE_MEMBERS,
  ],
  [TEAM_ADMIN_ROLE]: [
    TEAM_ACTIONS.LIST_MEMBERS,
    TEAM_ACTIONS.INVITE_MEMBERS,
    TEAM_ACTIONS.REMOVE_MEMBERS,
  ],
  [TEAM_MEMBER_ROLE]: [TEAM_ACTIONS.LIST_MEMBERS],
};

const ACTION_DENIED_MESSAGES = {
  [TEAM_ACTIONS.LIST_MEMBERS]:
    "You do not have permission to view members of this team.",
  [TEAM_ACTIONS.INVITE_MEMBERS]:
    "You do not have permission to invite members to this team.",
  [TEAM_ACTIONS.REMOVE_MEMBERS]:
    "You do not have permission to remove members from this team.",
};

module.exports = {
  TEAM_ACTIONS,
  ROLE_PERMISSIONS,
  ACTION_DENIED_MESSAGES,
};
