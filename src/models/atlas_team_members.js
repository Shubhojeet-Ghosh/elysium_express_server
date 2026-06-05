const mongoose = require("mongoose");

const MEMBER_STATUSES = ["active", "removed"];
const MEMBER_ROLES = ["member"];

const atlasTeamMemberSchema = new mongoose.Schema(
  {
    team_id: {
      type: String,
      required: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: MEMBER_ROLES,
      default: "member",
    },
    status: {
      type: String,
      enum: MEMBER_STATUSES,
      default: "active",
      index: true,
    },
    invited_by_user_id: {
      type: String,
      required: true,
    },
    invitation_id: {
      type: String,
      default: null,
    },
    joined_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "atlas_team_members",
  },
);

atlasTeamMemberSchema.index(
  { team_id: 1, user_id: 1 },
  { unique: true, name: "team_user_unique" },
);

atlasTeamMemberSchema.index(
  { team_id: 1, status: 1 },
  { name: "team_active_members" },
);

atlasTeamMemberSchema.index(
  { user_id: 1, status: 1 },
  { name: "user_teams" },
);

const AtlasTeamMember = mongoose.model("AtlasTeamMember", atlasTeamMemberSchema);

module.exports = AtlasTeamMember;
module.exports.MEMBER_STATUSES = MEMBER_STATUSES;
module.exports.MEMBER_ROLES = MEMBER_ROLES;
