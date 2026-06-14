# Team Members API — Frontend Integration Guide

This document is written for the **frontend team**. It covers every endpoint, request/response shape, and every outcome case you need to handle in the UI.

For backend/MongoDB internals, see [`team-members-api.md`](./team-members-api.md).

---

## Quick reference

| # | Method | Endpoint | Auth required? |
|---|--------|----------|----------------|
| 1 | `POST` | `/elysium-atlas/v1/team/members/invite` | Yes — owner or admin |
| 2 | `POST` | `/elysium-atlas/v1/team/members/invitation/preview` | No — invite token in body |
| 3 | `POST` | `/elysium-atlas/v1/team/members/invitation/respond` | No — invite token in body |
| 4 | `GET`  | `/elysium-atlas/v1/team/members` | Yes — any team member |
| 5 | `POST` | `/elysium-atlas/v1/team/members/remove` | Yes — owner or admin |

**Base URL example:** `https://your-api.com/elysium-atlas`

---

## Team capacity & plan limits

Team size is **not** stored as counters on the team document. The backend counts members live from the database on each request.

| What | Where it comes from |
|------|---------------------|
| **Max team size** | Owner's `atlas_teams.max_members` — updated on **`POST /plan/assign`** from plan's `max_team_members` |
| **Current team size** | Owner's `atlas_teams.member_count` (refreshed live: 1 + active members) |
| **Plan info API** | `max_team_members` + `member_count` in **`original_limits`** (from `atlas_teams`) — not in `available_limits` |

**Capacity check (invite / accept):**

```
current_team_size = 1 + active_accepted_members
pending_invites   = pending invitations (reserve slots when sending new invites)

Can invite new email if:
  member_count + pending_invites + 1 <= max_team_members   (from atlas_teams)

Can accept invite if:
  member_count + 1 <= max_team_members
```

**Get max team size for UI** — use plan info:

```
POST /elysium-atlas/v1/plan/info
→ plan_data.original_limits.max_team_members
→ plan_data.original_limits.member_count
→ plan_data.team (same values + team_id)
```

**Get current size for UI** — use list members:

```
GET /elysium-atlas/v1/team/members
→ current_team_size and max_team_members
```

`available_limits` in plan info is for **consumable** limits only (e.g. `ai_queries`). It will **never** include `max_team_members`.

---

## Authentication

### Authenticated team member APIs

Use the same session token you get from Atlas login (`/elysium-atlas/v1/auth/magic-link` or password login).

```http
Authorization: Bearer <sessionToken>
Content-Type: application/json
```

The session token must include `team_id` and `role` — the **active team the user chose at login** (or their only team). See [Frontend Auth Guide](./frontend-auth-guide.md) for the team selection flow and role values (`"owner"` | `"admin"` | `"member"`).

All team member APIs scope authorization to **`req.user.team_id`** plus the caller's role for that team (resolved from DB on each request).

| API | Required role |
|-----|---------------|
| List members | `owner`, `admin`, or `member` |
| Invite members | `owner` or `admin` |
| Remove members | `owner` or `admin` |

Members who call invite/remove receive **403** with a permission message. Gate these actions in the UI using `user.role` from login (but trust the API as source of truth).

---

## Roles

| Role | Set via | Notes |
|------|---------|-------|
| `"owner"` | Team creation / login | Full team management (list, invite, remove) |
| `"admin"` | Invite API (`role: "admin"`) | Same as owner for member APIs (list, invite, remove) |
| `"member"` | Invite API (`role: "member"`, default) | List members only — invite/remove return 403 |

When inviting, pass `"admin"` or `"member"` in the request body. Invalid values return `400`:

```json
{ "success": false, "message": "Invalid role. Must be \"admin\" or \"member\"." }
```

After login, the user's session `role` reflects their role **for the active team** (see auth guide). Invitation preview/respond responses include the invited `role`.

---

### Invitee APIs (preview + respond)

**No login required.** Pass the invite JWT from the email link in the request body.

---

## User journeys

### Journey A — Owner invites people

```
Owner UI → POST /invite → show per-email results → optionally refresh member list
```

### Journey B — Invitee accepts from email

```
Email link → Frontend page /team/invite/respond?token=...
           → POST /preview (load team info)
           → User clicks Accept or Decline
           → POST /respond
           → Show result screen
```

**Email link format the backend sends:**

```
{FRONTEND_URL}/team/invite/respond?token={inviteJwt}
```

Read `token` from the URL query string on page load.

---

# API 1 — Invite team members

**Who calls this:** Team owner only  
**When:** Owner enters one or more emails and clicks "Invite"

### Request

```
POST /elysium-atlas/v1/team/members/invite
```

**Headers:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs...",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "emails": [
    "alice@example.com",
    "bob@example.com",
    "unknown@example.com"
  ],
  "role": "member"
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `emails` | Yes | `string[]` | 1 to 50 emails per request |
| `role` | No | `string` | Default `"member"`. Must be `"admin"` or `"member"` |

---

### Response — success (HTTP 200)

The API **always processes the full batch**. One bad email does not fail the whole request.

```json
{
  "success": true,
  "message": "Invitation batch processed.",
  "team_id": "665a1b2c3d4e5f6789012345",
  "summary": {
    "total": 3,
    "processed": 2,
    "skipped": 1
  },
  "results": [
    {
      "email": "alice@example.com",
      "status": "invited",
      "email_resent": false,
      "invitation_id": "665a1b2c3d4e5f6789012346",
      "user_id": "665a1b2c3d4e5f6789012347",
      "expires_at": "2026-06-12T10:00:00.000Z"
    },
    {
      "email": "bob@example.com",
      "status": "already_invited",
      "email_resent": true,
      "invitation_id": "665a1b2c3d4e5f6789012348",
      "user_id": "665a1b2c3d4e5f6789012349",
      "expires_at": "2026-06-12T10:00:00.000Z"
    },
    {
      "email": "unknown@example.com",
      "status": "not_registered"
    }
  ]
}
```

**How to use `summary`:**
- `processed` = emails where an invite was sent (`invited` or `already_invited`)
- `skipped` = everything else

**How to use `results[]`:** Loop and show a status badge/message per email (see table below).

---

### Every possible `results[].status` — invite API

Handle **each email independently** based on its `status`:

| Status | What happened | Email sent? | Suggested UI message |
|--------|---------------|-------------|----------------------|
| `invited` | New invitation created | Yes | "Invitation sent to {email}" |
| `already_invited` | Pending invite existed; expiry reset to 7 days | Yes (resent) | "Invitation resent to {email}" |
| `not_registered` | No Atlas account for this email | No | "No account found for {email}. They must sign up first." |
| `profile_incomplete` | Account exists but profile not finished | No | "{email} has not completed their profile yet." |
| `already_member` | User is already on this team | No | "{email} is already a team member." |
| `self_invite` | Owner tried to invite themselves | No | "You cannot invite your own email." |
| `invalid_email` | Bad email format or empty | No | "Invalid email: {email}" |
| `duplicate_in_request` | Same email listed twice in one batch | No | "Duplicate email in this list: {email}" |
| `team_full` | Team at plan capacity | No | "Team is full. Upgrade your plan or wait for pending invites to expire." |
| `email_send_failed` | Invite saved but email could not be sent | No | "Could not send email to {email}. Try again." |
| `invitation_unavailable` | Rare conflict while updating invite | No | "Could not process {email}. Try again." |

---

### Example responses — one status per email

**Case: user is eligible (first time invite)**
```json
{
  "email": "alice@example.com",
  "status": "invited",
  "email_resent": false,
  "invitation_id": "665a1b2c3d4e5f6789012346",
  "user_id": "665a1b2c3d4e5f6789012347",
  "expires_at": "2026-06-12T10:00:00.000Z"
}
```

**Case: user already has a pending invite (email resent, expiry refreshed)**
```json
{
  "email": "bob@example.com",
  "status": "already_invited",
  "email_resent": true,
  "invitation_id": "665a1b2c3d4e5f6789012348",
  "user_id": "665a1b2c3d4e5f6789012349",
  "expires_at": "2026-06-12T10:00:00.000Z"
}
```

**Case: user is already a team member**
```json
{
  "email": "carol@example.com",
  "status": "already_member",
  "user_id": "665a1b2c3d4e5f6789012350"
}
```

**Case: user not registered on Atlas**
```json
{
  "email": "unknown@example.com",
  "status": "not_registered"
}
```

**Case: user exists but profile incomplete**
```json
{
  "email": "incomplete@example.com",
  "status": "profile_incomplete",
  "user_id": "665a1b2c3d4e5f6789012351"
}
```

**Case: owner invited themselves**
```json
{
  "email": "owner@example.com",
  "status": "self_invite"
}
```

**Case: team at capacity**
```json
{
  "email": "dave@example.com",
  "status": "team_full"
}
```

**Case: duplicate email in same request**
```json
{
  "email": "alice@example.com",
  "status": "duplicate_in_request"
}
```

**Case: invalid email format**
```json
{
  "email": "not-an-email",
  "status": "invalid_email"
}
```

---

### Response — whole-request errors

These mean the **entire request failed** (not per-email):

| HTTP | Response body | When | Frontend action |
|------|---------------|------|-----------------|
| `401` | `{ "success": false, "message": "No token provided." }` | Missing Authorization header | Redirect to login |
| `401` | `{ "success": false, "message": "Invalid or expired token." }` | Bad/expired session | Redirect to login |
| `400` | `{ "success": false, "message": "At least one email is required." }` | Empty `emails` array | Show validation error |
| `400` | `{ "success": false, "message": "You can invite up to 50 emails per request." }` | More than 50 emails | Ask user to split the list |
| `400` | `{ "success": false, "message": "Team ID is missing from session." }` | Session has no `team_id` | Re-login or contact support |
| `403` | `{ "success": false, "message": "You do not have permission to invite members to this team." }` | User is member (not owner/admin) | Hide invite UI |
| `500` | `{ "success": false, "message": "Server error." }` | Server crash | Show generic error + retry |

---

# API 2 — Preview invitation

**Who calls this:** Invitee (anyone with the link)  
**When:** Invite landing page loads — before showing Accept/Decline buttons

### Request

```
POST /elysium-atlas/v1/team/members/invitation/preview
```

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `token` | Yes | `string` | JWT from URL `?token=...` |

---

### Response — valid pending invitation (HTTP 200)

```json
{
  "success": true,
  "invitation": {
    "invitation_id": "665a1b2c3d4e5f6789012346",
    "team_id": "665a1b2c3d4e5f6789012345",
    "team_name": "Acme Workspace",
    "inviter": {
      "user_id": "665a1b2c3d4e5f6789012300",
      "email": "owner@example.com",
      "first_name": "Jane",
      "last_name": "Doe"
    },
    "invitee": {
      "user_id": "665a1b2c3d4e5f6789012347",
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Smith"
    },
    "role": "member",
    "expires_at": "2026-06-12T10:00:00.000Z",
    "status": "pending"
  }
}
```

**Suggested UI when `success: true`:**
- Show: *"{inviter.first_name} invited you to join {team_name}"*
- Show invitee email: `{invitee.email}`
- Show expiry date from `expires_at`
- Show **Accept** and **Decline** buttons

---

### Response — every failure case (HTTP 200)

**Case: token missing (HTTP 400)**
```json
{
  "success": false,
  "message": "Token is required."
}
```
→ Show: "Invalid invitation link."

**Case: token invalid or JWT expired**
```json
{
  "success": false,
  "message": "Invalid or expired invitation."
}
```
→ Show: "This invitation link is invalid or has expired."

**Case: invitation already used (accepted)**
```json
{
  "success": false,
  "message": "This invitation is no longer available.",
  "invitation_status": "accepted"
}
```
→ Show: "You have already responded to this invitation."

**Case: invitation declined**
```json
{
  "success": false,
  "message": "This invitation is no longer available.",
  "invitation_status": "declined"
}
```
→ Show: "This invitation was declined."

**Case: invitation expired (past 7 days)**
```json
{
  "success": false,
  "message": "This invitation is no longer available.",
  "invitation_status": "pending"
}
```
→ Show: "This invitation has expired. Ask the team owner to send a new one."

**Case: invitee account no longer valid**
```json
{
  "success": false,
  "message": "This invitation is no longer valid."
}
```
→ Show: "This invitation is no longer valid."

**Case: server error (HTTP 500)**
```json
{
  "success": false,
  "message": "Server error."
}
```

---

# API 3 — Respond to invitation

**Who calls this:** Invitee  
**When:** User clicks Accept or Decline on the invite landing page  
**Auth:** Token only — user does **not** need to be logged in

### Request — accept

```
POST /elysium-atlas/v1/team/members/invitation/respond
```

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accept": true
}
```

### Request — decline

**Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "accept": false
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `token` | Yes | `string` | Same JWT from URL |
| `accept` | Yes | `boolean` | `true` = join team, `false` = decline |

---

### Response — accept success (HTTP 200)

**Case: user joins the team (not a member before)**
```json
{
  "success": true,
  "message": "You have joined the team.",
  "membership": {
    "team_id": "665a1b2c3d4e5f6789012345",
    "team_name": "Acme Workspace",
    "role": "member",
    "joined_at": "2026-06-05T12:00:00.000Z"
  }
}
```
→ Show: "Welcome! You joined {membership.team_name}."

**Case: user was already a member (safe to treat as success)**
```json
{
  "success": true,
  "message": "You are already a member of this team.",
  "membership": {
    "team_id": "665a1b2c3d4e5f6789012345",
    "team_name": "Acme Workspace",
    "role": "member",
    "joined_at": "2026-06-01T08:00:00.000Z"
  }
}
```
→ Show: "You are already a member of {membership.team_name}."

---

### Response — decline success (HTTP 200)

```json
{
  "success": true,
  "message": "Invitation declined."
}
```
→ Show: "You declined the invitation."

---

### Response — accept/decline failures (HTTP 200)

**Case: invalid or expired token**
```json
{
  "success": false,
  "message": "Invalid or expired invitation."
}
```

**Case: invitation already handled or expired**
```json
{
  "success": false,
  "message": "This invitation is no longer available.",
  "invitation_status": "accepted"
}
```
Possible `invitation_status` values: `accepted` | `declined` | `expired` | `revoked` | `pending`

**Case: team deleted or suspended**
```json
{
  "success": false,
  "message": "This team is no longer available."
}
```

**Case: invitee profile no longer complete**
```json
{
  "success": false,
  "message": "Your account is not eligible to join this team."
}
```

**Case: team is full (accept only)**
```json
{
  "success": false,
  "message": "Team is full."
}
```

**Case: missing accept field**
```json
{
  "success": false,
  "message": "The accept field must be true or false."
}
```

**Case: generic processing error**
```json
{
  "success": false,
  "message": "Unable to process invitation."
}
```

**Case: token missing (HTTP 400)**
```json
{
  "success": false,
  "message": "Token is required."
}
```

---

### Respond API — decision tree for frontend

```
POST /respond with { token, accept }

if HTTP 400 && message === "Token is required"
  → show "Invalid link"

if success === false
  → show message from response (map known messages to friendly copy)

if success === true && accept === false
  → show "Invitation declined"

if success === true && message includes "already a member"
  → show already-member screen (still success)

if success === true && membership present
  → show welcome / joined screen
```

---

# API 4 — List team members

**Who calls this:** Team owner only  
**When:** Owner opens team members page, or after sending invites

### Request

```
GET /elysium-atlas/v1/team/members?page=1&limit=50&status=active
```

**Headers:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
}
```

**Query params:**

| Param | Required | Default | Max | Description |
|-------|----------|---------|-----|-------------|
| `page` | No | `1` | — | Page number (starts at 1) |
| `limit` | No | `50` | `100` | Members per page |
| `status` | No | `active` | — | Filter: `active` or `removed` |

**No request body** — this is a GET request.

---

### Response — success (HTTP 200)

```json
{
  "success": true,
  "team_id": "665a1b2c3d4e5f6789012345",
  "current_team_size": 5,
  "max_team_members": 55,
  "page": 1,
  "limit": 50,
  "total": 5,
  "members": [
    {
      "user_id": "665a1b2c3d4e5f6789012300",
      "email": "owner@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "profile_image_url": null,
      "role": "owner",
      "status": "active",
      "joined_at": "2026-02-25T06:51:29.737Z"
    },
    {
      "user_id": "665a1b2c3d4e5f6789012347",
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Smith",
      "profile_image_url": "https://cdn.example.com/alice.jpg",
      "role": "member",
      "status": "active",
      "joined_at": "2026-06-05T12:00:00.000Z"
    },
    {
      "user_id": "665a1b2c3d4e5f6789012349",
      "email": "bob@example.com",
      "first_name": "Bob",
      "last_name": "Jones",
      "profile_image_url": null,
      "role": "member",
      "status": "active",
      "joined_at": "2026-06-04T09:30:00.000Z"
    }
  ]
}
```

**Important fields for UI:**

| Field | Meaning |
|-------|---------|
| `current_team_size` | Live count: **owner (1) + accepted members** |
| `max_team_members` | Max allowed from owner's `atlas_teams.max_members` |
| `total` | Count for pagination: **owner + invited members** when `status=active`; invited rows only when `status=removed` |
| `members[]` | Paginated list — when `status=active`, **owner is always first on page 1** (`role: "owner"`), then `admin` / `member` rows |

**Suggested UI:**
- Show capacity bar: `{current_team_size} / {max_team_members} members`
- Or use `POST /plan/info` → `original_limits.member_count` / `original_limits.max_team_members`
- Paginate with `page` and `limit` when `total > limit`
- Display name as `{first_name} {last_name}` or fall back to `email`
- Use `profile_image_url` for avatar (may be `null`)

**Solo team (owner only, no accepted invites yet):**
```json
{
  "success": true,
  "team_id": "665a1b2c3d4e5f6789012345",
  "current_team_size": 1,
  "max_team_members": 55,
  "page": 1,
  "limit": 50,
  "total": 1,
  "members": [
    {
      "user_id": "665a1b2c3d4e5f6789012300",
      "email": "owner@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "profile_image_url": null,
      "role": "owner",
      "status": "active",
      "joined_at": "2026-02-25T06:51:29.737Z"
    }
  ]
}
```
→ Owner appears in `members[]` with `role: "owner"`.

---

### Response — errors

| HTTP | Body | Frontend action |
|------|------|-----------------|
| `401` | `{ "success": false, "message": "No token provided." }` | Redirect to login |
| `401` | `{ "success": false, "message": "Invalid or expired token." }` | Redirect to login |
| `403` | `{ "success": false, "message": "You do not have permission to view members of this team." }` | Not a team member | Hide members page |
| `500` | `{ "success": false, "message": "Server error." }` | Show retry |

---

# API 5 — Remove team member

**Who calls this:** Team **owner** only  
**When:** Owner removes an accepted member from the team

Soft-removes the member (`status: "removed"`). No counters are updated — capacity is recalculated live on the next request.

### Request

```
POST /elysium-atlas/v1/team/members/remove
```

**Headers:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs...",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "user_id": "665a1b2c3d4e5f6789012347"
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `user_id` | Yes | `string` | MongoDB user id of the member to remove |

---

### Response — success (HTTP 200)

```json
{
  "success": true,
  "message": "Team member removed.",
  "member": {
    "user_id": "665a1b2c3d4e5f6789012347",
    "email": "alice@example.com",
    "role": "member",
    "status": "removed"
  }
}
```

**Suggested UI:** Remove member from list, refresh `GET /team/members` to update `current_team_size`.

---

### Response — every failure case

**Case: missing user_id (HTTP 400)**
```json
{
  "success": false,
  "message": "user_id is required."
}
```

**Case: caller is not team owner (HTTP 403)**
```json
{
  "success": false,
  "message": "You do not have permission to remove members from this team."
}
```

**Case: trying to remove the owner (HTTP 400)**
```json
{
  "success": false,
  "message": "The team owner cannot be removed."
}
```

**Case: user was never on the team (HTTP 404)**
```json
{
  "success": false,
  "message": "This user is not a member of your team."
}
```

**Case: already removed (HTTP 200)**
```json
{
  "success": false,
  "message": "This member has already been removed.",
  "member": {
    "user_id": "665a1b2c3d4e5f6789012347",
    "email": "alice@example.com",
    "status": "removed"
  }
}
```

**Case: server error (HTTP 500)**
```json
{
  "success": false,
  "message": "Server error."
}
```

---

## Frontend pages to build

### 1. Team settings — Invite members (owner)

- Input: comma-separated or multi-email input
- On submit: `POST /invite`
- Show results table with status per email (use status table above)
- Show `{current_team_size}/{max_team_members}` from list API (or plan info for max only)

### 2. Team settings — Members list (owner)

- On load: `GET /team/members?page=1&limit=50`
- Paginate if `total > limit`
- Refresh after successful invites (pending invites won't appear here until accepted)
- **Remove button** per member → `POST /team/members/remove` with `{ user_id }` → refresh list

### 3. Invite landing page (invitee)

**Route:** `/team/invite/respond?token=...`

**On mount:**
1. Read `token` from query
2. If missing → show error
3. `POST /preview` with `{ token }`
4. If `success: false` → show error (use cases above)
5. If `success: true` → show invitation details + Accept/Decline

**On Accept click:**
- `POST /respond` with `{ token, accept: true }`
- Handle all response cases above

**On Decline click:**
- `POST /respond` with `{ token, accept: false }`

---

## TypeScript types (optional)

```typescript
// --- Invite API ---

type InviteEmailStatus =
  | "invited"
  | "already_invited"
  | "not_registered"
  | "profile_incomplete"
  | "already_member"
  | "self_invite"
  | "invalid_email"
  | "duplicate_in_request"
  | "team_full"
  | "email_send_failed"
  | "invitation_unavailable";

type InvitableRole = "admin" | "member";
type TeamMemberRole = "admin" | "member";
type TeamListRole = "owner" | TeamMemberRole;

interface InviteEmailResult {
  email: string;
  status: InviteEmailStatus;
  email_resent?: boolean;
  invitation_id?: string;
  user_id?: string;
  expires_at?: string;
}

interface InviteResponse {
  success: boolean;
  message: string;
  team_id?: string;
  summary?: { total: number; processed: number; skipped: number };
  results?: InviteEmailResult[];
}

// --- Preview API ---

interface InvitationPreview {
  invitation_id: string;
  team_id: string;
  team_name: string | null;
  inviter: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  invitee: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  role: InvitableRole;
  expires_at: string;
  status: "pending";
}

interface PreviewResponse {
  success: boolean;
  message?: string;
  invitation?: InvitationPreview;
  invitation_status?: string;
}

// --- Respond API ---

interface Membership {
  team_id: string;
  team_name: string | null;
  role: TeamMemberRole;
  joined_at: string;
}

interface RespondResponse {
  success: boolean;
  message: string;
  membership?: Membership;
  invitation_status?: string;
}

// --- Remove member API ---

interface RemoveMemberResponse {
  success: boolean;
  message: string;
  member?: {
    user_id: string;
    email: string;
    role?: InvitableRole;
    status: "removed" | "active";
  };
}

// --- List members API ---

interface TeamMember {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  role: TeamListRole;
  status: "active" | "removed";
  joined_at: string;
}

interface ListMembersResponse {
  success: boolean;
  message?: string;
  team_id?: string;
  current_team_size?: number;
  max_team_members?: number;
  page?: number;
  limit?: number;
  total?: number;
  members?: TeamMember[];
}
```

---

## Plan info API (team-scoped)

**`POST /elysium-atlas/v1/plan/info`** — Bearer session JWT. Uses **`team_id` from the token** (active team), not the caller's personal plan.

Returns the **team owner's** subscription (`atlas_user_plans` + `atlas_user_available_plan_limits` for the owner) and **this team's** capacity from `atlas_teams`. Any team member (`owner`, `admin`, `member`) may call it.

```json
{
  "success": true,
  "plan_data": {
    "plan": { "plan_id": "enterprise-001", "plan_name": "enterprise-ai" },
    "original_limits": {
      "max_team_members": 55,
      "member_count": 5,
      "ai_queries": 5000,
      "max_visitor_message_chars": 8000
    },
    "available_limits": {
      "ai_queries": 4655,
      "max_visitor_message_chars": 4000
    },
    "team": {
      "team_id": "665a1b2c3d4e5f6789012345",
      "max_team_members": 55,
      "member_count": 5,
      "caller_role": "member"
    }
  }
}
```

| Field | Source | Notes |
|-------|--------|-------|
| `plan` | Team **owner's** `atlas_user_plans` | Same plan for all members of that team |
| `available_limits` | Team **owner's** `atlas_user_available_plan_limits` | Consumable limits only — no `max_team_members` |
| `original_limits.max_team_members` | Session team's `atlas_teams.max_members` | Team capacity — **source of truth** |
| `original_limits.member_count` | Session team's `atlas_teams.member_count` | Owner (1) + active members |
| `plan_data.team.team_id` | JWT `team_id` | Active team |
| `plan_data.team.caller_role` | Caller's role on this team | `owner` \| `admin` \| `member` |

**Errors:** `400` if `team_id` missing from session; `403` if caller is not on the team.

When a user switches teams at login, call `/plan/info` again — they see that team's plan and capacity.

| Field | Includes `max_team_members` / `member_count`? |
|-------|---------------------------------------------|
| `original_limits` | **Yes** — from `atlas_teams` |
| `plan_data.team` | **Yes** — from `atlas_teams` |
| `available_limits` | **No** — never includes `max_team_members` (legacy DB fields are ignored) |

---

## Important rules to remember

1. **Pending invites ≠ team members.** After invite, user appears in invite results as `invited`. They only appear in `GET /members` after they accept.

2. **Re-inviting the same email** returns `already_invited` and resends the email with a fresh 7-day expiry.

3. **Only registered users with completed profiles** can be invited. `not_registered` and `profile_incomplete` will never receive an email.

4. **Invite link expires in 7 days.** After that, preview/respond return failure.

5. **No login needed** on the invite landing page — the token in the URL is enough.

6. **Profile names come from the user account**, not stored on the membership. Always use `first_name`, `last_name`, `profile_image_url` from API responses.

7. **HTTP 200 with `success: false`** is normal for business errors (same pattern as Atlas auth). Always check the `success` field, not just HTTP status.

8. **No manual counter increments on join/leave** — `atlas_teams.member_count` is recomputed from active members when plan info, list, invite, accept, or remove runs.

9. **`max_team_members` and `member_count` come from `atlas_teams`** (in `original_limits` and `plan_data.team`), not from `available_limits`. **`POST /plan/assign`** sets `atlas_teams.max_members` from the plan's `max_team_members`.

10. **Only the team owner** can invite, list, or remove members. Invited members cannot perform these actions.

11. **Remove is a soft delete** — member `status` becomes `"removed"`. They no longer count toward `member_count`. A removed member can be **re-invited**; accepting sets their status back to `"active"` on the same document.

---

## Copy-paste fetch examples

```javascript
const BASE = "https://your-api.com/elysium-atlas";
const sessionToken = "..."; // from Atlas login

// 1. Invite
await fetch(`${BASE}/v1/team/members/invite`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    emails: ["alice@example.com"],
    role: "member",
  }),
});

// 2. Preview (invitee page)
const token = new URLSearchParams(window.location.search).get("token");
await fetch(`${BASE}/v1/team/members/invitation/preview`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token }),
});

// 3. Accept
await fetch(`${BASE}/v1/team/members/invitation/respond`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token, accept: true }),
});

// 4. List members
await fetch(`${BASE}/v1/team/members?page=1&limit=50`, {
  headers: { Authorization: `Bearer ${sessionToken}` },
});

// 5. Remove member
await fetch(`${BASE}/v1/team/members/remove`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ user_id: "665a1b2c3d4e5f6789012347" }),
});
```

---

## Questions?

Backend reference: [`team-members-api.md`](./team-members-api.md)
