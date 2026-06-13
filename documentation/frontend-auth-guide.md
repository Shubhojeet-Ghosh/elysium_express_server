# Elysium Atlas — Auth API (Frontend Integration Guide)

This document is for the **frontend team**. It covers all Atlas login methods, the **`teams`** array, and the **team selection** flow when a user belongs to more than one team.

**Base URL:** `https://your-api.com/elysium-atlas`  
**Local example:** `http://localhost:3001/elysium-atlas`

---

## What changed

### 1. `teams` array on login

Login responses include every team the user belongs to (owned + member).

### 2. Role-based access

Each team entry and the active session include a **`role`**:

| Role | Meaning |
|------|---------|
| `"owner"` | User owns this team |
| `"admin"` | User joined as an admin (via invitation) |
| `"member"` | User joined as a member (via invitation) |

- `user.role` and `sessionToken` JWT **`role`** reflect the **active** team context
- During team selection (phase 1, multi-team), `user.role` is `null` until a team is chosen
- Each item in `teams[]` includes its own `role` for the team picker UI

### 3. Team selection (multi-team users)

| User has | What happens |
|----------|----------------|
| **1 team only** | Direct login — `sessionToken` returned immediately (unchanged UX) |
| **2+ teams** | Phase 1: identity verified, **`selection_token`** returned (no `sessionToken`) |
| | Phase 2: user picks a team → `POST /select-team` → full login with chosen `team_id` |

**After final login:**
- `sessionToken` JWT contains **`team_id` = chosen team** and **`role`** for that team
- `user.team_id` = **chosen team**
- `user.role` = **`"owner"` | `"admin"` | `"member"`** for the chosen team
- `teams[]` still lists **all** teams (each with its own `role`)

---

## Quick reference

| # | Method | Endpoint | When |
|---|--------|----------|------|
| 1 | `POST` | `/v1/auth/magic-link` + `password` | Password login |
| 2 | `POST` | `/v1/auth/magic-link` (email only) | Send magic link email |
| 3 | `POST` | `/v1/auth/verify` | Verify magic link |
| 4 | `POST` | `/v1/auth/verify-google-login` | Google login |
| 5 | `POST` | `/v1/auth/select-team` | **Pick team** (phase 2) |
| 6 | `POST` | `/v1/auth/profile/update` | Update profile (Bearer token) |

---

## Decision tree (frontend)

```
Login (password / verify / Google)
        │
        ▼
  requires_team_selection === true ?
        │
   NO ──┴── YES
   │         │
   ▼         ▼
Store      Show team picker
sessionToken    │
   │         User selects team_id
   ▼              │
 Go to app        ▼
            POST /select-team
            { selection_token, team_id }
                  │
                  ▼
            Store sessionToken
                  │
                  ▼
              Go to app
```

---

## Phase 1 responses

Used by: **password login**, **magic link verify**, **Google login**.

### A — Single team (`teams.length === 1`) — direct login

```json
{
  "success": true,
  "message": "Login successful.",
  "is_profile_complete": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
  "teams": [
    {
      "team_id": "6a2207aed53ab069ecae88c8",
      "team_name": "testTeam",
      "is_owner": true,
      "role": "owner"
    }
  ],
  "user": {
    "user_id": "6a220791d53ab069ecae88c2",
    "team_id": "6a2207aed53ab069ecae88c8",
    "role": "owner",
    "email": "user@example.com",
    "first_name": "Shubh",
    "last_name": "Ghosh",
    "profile_image_url": null
  }
}
```

**No `requires_team_selection`.** Store `sessionToken` and proceed.

---

### B — Multiple teams — team selection required

```json
{
  "success": true,
  "requires_team_selection": true,
  "message": "Select a team to continue.",
  "selection_token": "eyJhbGciOiJIUzI1NiIs...",
  "is_profile_complete": true,
  "teams": [
    {
      "team_id": "6a2207aed53ab069ecae88c8",
      "team_name": "testTeam",
      "is_owner": true,
      "role": "owner"
    },
    {
      "team_id": "699e9bf195fcec2ed8ef6763",
      "team_name": "Shubhojeet",
      "is_owner": false,
      "role": "member"
    }
  ],
  "user": {
    "user_id": "6a220791d53ab069ecae88c2",
    "team_id": null,
    "role": null,
    "email": "user@example.com",
    "first_name": "Shubh",
    "last_name": "Ghosh",
    "profile_image_url": null
  }
}
```

| Field | Notes |
|-------|-------|
| `requires_team_selection` | `true` — show team picker |
| `selection_token` | Short-lived (~10 min). Use in phase 2. |
| **No `sessionToken`** | Do not store a session yet |
| `user.team_id` | `null` until team is selected |
| `user.role` | `null` until team is selected |

---

## Phase 2 — Select team

**`POST /elysium-atlas/v1/auth/select-team`**

### Request

```json
{
  "selection_token": "eyJhbGciOiJIUzI1NiIs...",
  "team_id": "699e9bf195fcec2ed8ef6763"
}
```

### Success — `200`

```json
{
  "success": true,
  "message": "Login successful.",
  "is_profile_complete": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
  "teams": [
    {
      "team_id": "6a2207aed53ab069ecae88c8",
      "team_name": "testTeam",
      "is_owner": true,
      "role": "owner"
    },
    {
      "team_id": "699e9bf195fcec2ed8ef6763",
      "team_name": "Shubhojeet",
      "is_owner": false,
      "role": "member"
    }
  ],
  "user": {
    "user_id": "6a220791d53ab069ecae88c2",
    "team_id": "699e9bf195fcec2ed8ef6763",
    "role": "member",
    "email": "user@example.com",
    "first_name": "Shubh",
    "last_name": "Ghosh",
    "profile_image_url": null
  }
}
```

`sessionToken`, `user.team_id`, and `user.role` reflect the **chosen** team.

### `sessionToken` JWT payload (after login)

```json
{
  "user_id": "6a220791d53ab069ecae88c2",
  "email": "user@example.com",
  "first_name": "Shubh",
  "last_name": "Ghosh",
  "is_profile_complete": true,
  "team_id": "699e9bf195fcec2ed8ef6763",
  "role": "member",
  "iat": 1781374961,
  "exp": 1783966961
}
```

Use `role` to gate UI (e.g. show invite/remove only for `owner` or `admin`). Team member APIs enforce permissions server-side via `team_id` + role.

### Failures

| HTTP | Response |
|------|----------|
| `400` | `{ "success": false, "message": "selection_token is required." }` |
| `400` | `{ "success": false, "message": "team_id is required." }` |
| `200` | `{ "success": false, "message": "Invalid or expired selection token." }` |
| `200` | `{ "success": false, "message": "You do not belong to this team." }` |
| `404` | `{ "success": false, "message": "User not found" }` |

If `selection_token` expires → send user back to login.

---

## API 1 — Password login

**`POST /elysium-atlas/v1/auth/magic-link`**

```json
{
  "email": "user@example.com",
  "password": "yourPassword"
}
```

Returns **phase 1** response (direct login or `requires_team_selection`).

### Failures — `200`

```json
{ "success": false, "message": "A valid email is required." }
```

```json
{ "success": false, "message": "This email is not registered." }
```

```json
{ "success": false, "message": "Invalid Password." }
```

---

## API 2 — Magic link send

**`POST /elysium-atlas/v1/auth/magic-link`** (email only, no password)

```json
{ "email": "user@example.com" }
```

```json
{
  "success": true,
  "message": "Magic link sent to your email.",
  "createdNewUser": false,
  "user_id": "6a220791d53ab069ecae88c2"
}
```

No session. User opens email link → **API 3**.

---

## API 3 — Magic link verify

**`POST /elysium-atlas/v1/auth/verify`**

Frontend route: `{FRONTEND_URL}/auth/verify?token={jwt}`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Returns **phase 1** response.

If `requires_team_selection` → show picker → **API 5**.

### Failures

| HTTP | Message |
|------|---------|
| `400` | `Token is required` |
| `200` | `Invalid or expired token...` |
| `404` | `User not found` |

---

## API 4 — Google login

**`POST /elysium-atlas/v1/auth/verify-google-login`**

```json
{
  "access_token": "<googleOAuthAccessToken>"
}
```

Returns **phase 1** response (new users usually have 1 team → direct login).

If `requires_team_selection` → show picker → **API 5**.

### Failures — `200`

```json
{ "success": false, "message": "Google access token is missing." }
```

```json
{ "success": false, "message": "Invalid or expired Google token." }
```

---

## The `teams` array

```json
{
  "team_id": "665a1b2c3d4e5f6789012345",
  "team_name": "Jane's Workspace",
  "is_owner": true,
  "role": "owner"
}
```

| Field | Meaning |
|-------|---------|
| `is_owner` | `true` if user **owns** this team; `false` if they **joined** via invitation |
| `role` | `"owner"` \| `"admin"` \| `"member"` — use this for permissions and team picker labels |

| `role` | Typical meaning |
|--------|-----------------|
| `"owner"` | Team creator; full team management |
| `"admin"` | Invited admin (future admin capabilities) |
| `"member"` | Invited member |

- Owned teams listed first
- Only active teams included
- Pending invites are **not** listed

### `user.team_id`, `user.role`, and `teams`

| When | `user.team_id` | `user.role` |
|------|----------------|-------------|
| Phase 1, multi-team | `null` | `null` |
| After `select-team` or single-team login | **Chosen / only** team id | Role for that team |
| In `sessionToken` JWT | Same as `user.team_id` | Same as `user.role` |

**Team management APIs** (invite/remove members) require `role === "owner"` or `role === "admin"` for the session's active `team_id`. List members is allowed for all roles including `member`.

---

## Frontend implementation

### Check after every phase-1 login

```javascript
const data = await response.json();

if (!data.success) {
  // handle error
  return;
}

if (data.requires_team_selection) {
  // Save for phase 2 — NOT a session token
  sessionStorage.setItem("selection_token", data.selection_token);
  sessionStorage.setItem("teams", JSON.stringify(data.teams));
  navigate("/select-team");
  return;
}

// Single team — full login
localStorage.setItem("sessionToken", data.sessionToken);
localStorage.setItem("teams", JSON.stringify(data.teams));
localStorage.setItem("activeTeamId", data.user.team_id);
localStorage.setItem("activeRole", data.user.role);
navigate("/dashboard");
```

### Team picker page

```javascript
async function completeTeamSelection(teamId) {
  const selection_token = sessionStorage.getItem("selection_token");

  const res = await fetch(`${BASE}/v1/auth/select-team`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selection_token, team_id: teamId }),
  });

  const data = await res.json();
  if (!data.success) {
    // show error or redirect to login if token expired
    return;
  }

  localStorage.setItem("sessionToken", data.sessionToken);
  localStorage.setItem("teams", JSON.stringify(data.teams));
  localStorage.setItem("activeTeamId", data.user.team_id);
  localStorage.setItem("activeRole", data.user.role);
  sessionStorage.removeItem("selection_token");
  navigate("/dashboard");
}
```

### Team picker UI

```javascript
teams.map((team) => (
  <button key={team.team_id} onClick={() => completeTeamSelection(team.team_id)}>
    {team.team_name ?? "Unnamed team"}
    {team.role === "owner" ? " (Your team)" : ` (${team.role})`}
  </button>
));
```

---

## TypeScript types

```typescript
type TeamRole = "owner" | "admin" | "member";

interface UserTeam {
  team_id: string;
  team_name: string | null;
  is_owner: boolean;
  role: TeamRole;
}

interface AtlasAuthUser {
  user_id: string;
  team_id: string | null;
  role: TeamRole | null;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
}

/** Phase 1 — direct login (single team) */
interface AtlasDirectLoginResponse {
  success: true;
  message: string;
  is_profile_complete: boolean;
  sessionToken: string;
  teams: UserTeam[];
  user: AtlasAuthUser & { team_id: string; role: TeamRole };
}

/** Phase 1 — team selection required */
interface AtlasTeamSelectionRequiredResponse {
  success: true;
  requires_team_selection: true;
  message: string;
  selection_token: string;
  is_profile_complete: boolean;
  teams: UserTeam[];
  user: AtlasAuthUser & { team_id: null; role: null };
}

/** Phase 2 — select-team success */
interface AtlasSelectTeamResponse {
  success: true;
  message: string;
  is_profile_complete: boolean;
  sessionToken: string;
  teams: UserTeam[];
  user: AtlasAuthUser & { team_id: string; role: TeamRole };
}
```

---

## Copy-paste fetch examples

```javascript
const BASE = "http://localhost:3001/elysium-atlas";

// Password login (phase 1)
const loginRes = await fetch(`${BASE}/v1/auth/magic-link`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "user@example.com", password: "secret" }),
});
const loginData = await loginRes.json();

if (loginData.requires_team_selection) {
  // Magic link verify / Google follow the same pattern
  const selectRes = await fetch(`${BASE}/v1/auth/select-team`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selection_token: loginData.selection_token,
      team_id: "699e9bf195fcec2ed8ef6763",
    }),
  });
  const sessionData = await selectRes.json();
  // sessionData.sessionToken, sessionData.user.team_id
}

// Magic link verify (phase 1)
const verifyRes = await fetch(`${BASE}/v1/auth/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: magicLinkToken }),
});

// Google login (phase 1)
const googleRes = await fetch(`${BASE}/v1/auth/verify-google-login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ access_token: googleAccessToken }),
});
```

---

## Common scenarios

| Scenario | Result |
|----------|--------|
| New user, first login | 1 owned team → direct login |
| Owner only, no invites accepted elsewhere | 1 team → direct login |
| Owner + member of 1 other team | `requires_team_selection: true` |
| User picks member team | `user.team_id` = member team; `user.role` = `"member"` or `"admin"`; invite/remove return 403 for `"member"` |
| User picks own team | `user.team_id` = owned team; `user.role` = `"owner"`; full team management |

---

## Internal — Decode token (Postman / debugging)

**`POST /elysium-atlas/v1/auth/decode-token`**

Protected by `APPLICATION_SECRET_KEY` (same as plan admin routes). **Not for frontend use.**

### Headers

```json
{
  "Authorization": "<APPLICATION_SECRET_KEY>",
  "Content-Type": "application/json"
}
```

Set `Authorization` to the **raw secret only** — do **not** use `Bearer`.

### Request body

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Or query param: `?token=...`

### Success — valid token — `200`

```json
{
  "success": true,
  "valid": true,
  "expired": false,
  "payload": {
    "user_id": "6a220791d53ab069ecae88c2",
    "email": "user@example.com",
    "team_id": "699e9bf195fcec2ed8ef6763",
    "role": "member",
    "iat": 1781374961,
    "exp": 1783966961
  },
  "header": { "alg": "HS256", "typ": "JWT" },
  "issued_at": "2026-06-13T10:00:00.000Z",
  "expires_at": "2026-07-13T10:00:00.000Z"
}
```

### Success — expired token — `200`

```json
{
  "success": true,
  "valid": false,
  "expired": true,
  "error": "TokenExpiredError",
  "message": "jwt expired",
  "payload": {
    "user_id": "...",
    "team_id": "...",
    "exp": 1783966961
  },
  "header": { "alg": "HS256", "typ": "JWT" },
  "issued_at": "2026-06-13T10:00:00.000Z",
  "expires_at": "2026-07-13T10:00:00.000Z"
}
```

### Auth failures — `200`

```json
{ "success": false, "message": "Authorization header is required." }
```

```json
{ "success": false, "message": "Use the raw APPLICATION_SECRET_KEY in Authorization (no Bearer prefix)." }
```

```json
{ "success": false, "message": "Invalid Authorization." }
```

---

## Related docs

- [Team members guide](./frontend-team-members-guide.md)
- [Short auth reference](./atlas-auth-api.md)
