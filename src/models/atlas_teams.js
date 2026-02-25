const mongoose = require("mongoose");

/**
 * atlas_teams collection
 *
 * Every user gets a personal team on sign-up (is_personal: true).
 * Additional teams can be created or joined later (is_personal: false).
 * Team membership details (roles, invites, etc.) live in a separate
 * atlas_team_members collection to keep this document lean.
 */
const atlasTeamSchema = new mongoose.Schema(
  {
    // --- Core identifiers ---
    owner_user_id: {
      type: String,
      required: true,
      index: true,
      // The user who created / owns this team
    },
    owner_email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    team_name: {
      type: String,
      default: null,
      trim: true,
      // e.g. "John's Workspace" (auto-set to username once profile is complete)
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    avatar_url: {
      type: String,
      default: null,
      trim: true,
    },

    // --- Status ---
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
      index: true,
      // "suspended" → admin-disabled, members cannot access
      // "deleted"   → soft-deleted, retained for audit trail
    },

    // --- Membership counters (denormalized for fast reads) ---
    member_count: {
      type: Number,
      default: 1,
      min: 1,
      // Incremented / decremented as members join or leave
    },
    max_members: {
      type: Number,
      default: 1,
      // Driven by the team's plan; 1 = personal (solo), higher for paid tiers
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
    collection: "atlas_teams",
  },
);

// --- Compound indexes for common query patterns ---

// Find a user's personal team quickly (used on every login)
atlasTeamSchema.index({ owner_user_id: 1 });

// List all teams owned by a user
atlasTeamSchema.index({ owner_user_id: 1, is_active: 1 });

const AtlasTeam = mongoose.model("AtlasTeam", atlasTeamSchema);

module.exports = AtlasTeam;
