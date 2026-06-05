const mongoose = require("mongoose");

const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "revoked",
];

const atlasTeamInvitationSchema = new mongoose.Schema(
  {
    team_id: {
      type: String,
      required: true,
      index: true,
    },
    inviter_user_id: {
      type: String,
      required: true,
      index: true,
    },
    invitee_user_id: {
      type: String,
      required: true,
      index: true,
    },
    invitee_email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["member"],
      default: "member",
    },
    status: {
      type: String,
      enum: INVITATION_STATUSES,
      default: "pending",
      index: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    responded_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "atlas_team_invitations",
  },
);

atlasTeamInvitationSchema.index(
  { team_id: 1, invitee_email: 1, status: 1 },
  { name: "team_invitee_status" },
);

atlasTeamInvitationSchema.index(
  { invitee_user_id: 1, status: 1 },
  { name: "invitee_status" },
);

const AtlasTeamInvitation = mongoose.model(
  "AtlasTeamInvitation",
  atlasTeamInvitationSchema,
);

module.exports = AtlasTeamInvitation;
module.exports.INVITATION_STATUSES = INVITATION_STATUSES;
