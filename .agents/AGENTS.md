# BlockVote agent context

This project inherits agent skills for UI and mobile work. Skills are installed via [skills.sh](https://skills.sh/) and apply to Cursor and other compatible agents.

## Installed skills (project)

| Skill | Source | Use when |
|-------|--------|----------|
| `frontend-design` | anthropics/skills | Admin/guardian web UI polish, layout, typography |
| `web-design-guidelines` | vercel-labs/agent-skills | Next.js accessibility and UX patterns |
| `mobile-android-design` | wshobson/agents | Android voter app UI conventions |
| `android-mobile-frontend-design` | krutikjain/android-agent-skills | Compose / Fluent-style mobile UI |

Install or refresh:

```bash
npx skills add anthropics/skills --skill frontend-design -y
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -y
npx skills add wshobson/agents --skill mobile-android-design -y
npx skills add krutikjain/android-agent-skills --skill android-mobile-frontend-design -y
```

## UI stack conventions

### Web (admin + guardians) — `Voting/`

- **Fluent UI v9** (`@fluentui/react-components`) via `FluentProviderWrapper`
- Routes wrapped: `/dashboard`, `/admin`
- Party symbols: S3 image URLs only (no emoji) — see `PartySymbol.jsx`, `POST /api/uploads`
- Existing Tailwind tokens in `globals.css` remain for layout shells

### Android (voters) — `app/`

- Jetpack Compose + Material 3
- **Fluent Design tokens** in `ui/theme/Color.kt` (Communication Blue `#0078D4`)
- Party symbols loaded with Coil from API `symbol` field (HTTPS URL)
- API base URL: `-PapiBaseUrl=` Gradle property

## Key paths

```
Voting/app/dashboard/     Election admin (Fluent UI)
Voting/app/admin/         Guardian portal (Fluent UI)
Voting/app/api/uploads/   S3 party symbol upload
app/.../VotePortalScreen  Voter ballot UI
scripts/dev-server.ps1    Start backend
scripts/run-emulator.ps1  Build + run Android on emulator
```

## Docs

- [RUNNING.md](../RUNNING.md) — local development
- [HOSTING.md](../HOSTING.md) — Vercel/AWS/S3/Android release
