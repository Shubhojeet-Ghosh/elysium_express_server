# Elysium Atlas — Auth API (short reference)

> **Frontend integration:** use the full guide → [**frontend-auth-guide.md**](./frontend-auth-guide.md)

Base URL: `{SERVER_URL}/elysium-atlas`

## Login endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/auth/magic-link` | Password login or send magic link email |
| `POST /v1/auth/verify` | Verify magic link token |
| `POST /v1/auth/verify-google-login` | Google OAuth login |
| `POST /v1/auth/select-team` | **Phase 2** — pick team when `requires_team_selection: true` |
| `POST /v1/auth/decode-token` | **Internal** — decode JWT (`Authorization: APPLICATION_SECRET_KEY`) |

## Team selection rule

- `teams.length <= 1` → immediate `sessionToken` (includes `role`)
- `teams.length > 1` → `requires_team_selection: true` + `selection_token` (no session yet)

Session JWT includes `role`: `"owner"` | `"admin"` | `"member"` for the active team.

See [frontend-auth-guide.md](./frontend-auth-guide.md) for full flows and JSON examples.
