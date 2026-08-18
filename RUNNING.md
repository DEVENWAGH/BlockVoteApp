# Running BlockVote Locally

Guide for starting the Next.js backend and Android voter app on Windows.

## Environment profiles (local vs production)

| Where | What |
|-------|------|
| `Voting/.env.development` → `.env` | Only env used on this PC (Hardhat + `blockvote_local`) |
| **Vercel** project env | Real production secrets for https://www.devz.co.in |
| `Voting/.env.production` | Optional local archive for `yarn deploy:sepolia` keys — **never** activated for Next |

```powershell
cd Voting
yarn env:init      # one-time local profile
yarn env:dev       # daily local work
yarn env:status
```

- `yarn dev` / `yarn deploy:proxy` use **development** only
- Production Next.js / DB / guardians = **Vercel dashboard** (not `yarn env:prod`)
- After a Sepolia contract deploy, paste the new `NEXT_PUBLIC_CONTRACT_ADDRESS` into Vercel
- `yarn vanish` / `yarn db:reset` refuse non-local Mongo

Vercel should use the **production** values (set in Vercel dashboard), not your local Hardhat file.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Next.js / Hardhat backend |
| Yarn | 1.22+ | Package manager (`Voting/`) |
| MongoDB | 6+ | Database (Compass or `mongod` on `:27017`) |
| Android Studio | Latest | SDK, emulator, Gradle |
| JDK | 17 | Android builds |

Optional: MetaMask for the Guardian portal (`/admin`).

## 1. Backend (Next.js + Hardhat)

### One-time setup

```powershell
cd C:\Users\Devil\Desktop\blockvote\Voting
yarn install
yarn env:init
# Review .env.development (local DB) and .env.production (Sepolia + live Mongo)
```

Ensure MongoDB is running locally. Development uses a **separate** database:

```
mongodb://127.0.0.1:27017/blockvote_local
```

### Start (recommended script)

From the repo root:

```powershell
.\scripts\dev-server.ps1
```

This runs `yarn env:dev` + `yarn dev` in `Voting/`, which:

1. Activates the development profile
2. Starts Hardhat node on `http://127.0.0.1:8545`
3. Deploys the voting contract (writes addresses into `.env` + `.env.development`)
4. Starts Next.js on `http://0.0.0.0:3000`

### Next.js only (no Hardhat)

```powershell
cd Voting
yarn env:dev
yarn dev:next-only
```

Do not point local Next at production secrets — production runs on Vercel.

### Verify

- Landing page: http://localhost:3000
- Voter web beta: http://localhost:3000/portal
- Invite (opens app on phones): http://localhost:3000/go/<electionId>
- Admin dashboard: http://localhost:3000/dashboard (after signup/login)
- Guardian portal: http://localhost:3000/admin (MetaMask + guardian wallet)

## 2. Android app

Two Gradle flavors:

| Flavor | Default API | Use when |
|--------|-------------|----------|
| `local` | `http://10.0.2.2:3000/` | Daily testing with `yarn env:dev` |
| `prod` | `https://www.devz.co.in/` | Demo against live site / Sepolia |

### Emulator → local backend

```powershell
.\scripts\run-emulator.ps1
```

### Physical device → local backend

```powershell
.\scripts\run-device.ps1
```

### Device / emulator → live site

```powershell
.\scripts\run-prod-apk.ps1
```

### Deep link test

```powershell
adb shell am start -a android.intent.action.VIEW -d "blockvote://vote/<electionId>"
```

Or open the web invite link: `http://localhost:3000/go/<electionId>` (phones try the app; computers can continue on `/portal/<electionId>`).

Web beta ballot (desktop, no surrounding monitor): `http://localhost:3000/portal`

## 3. Party symbol uploads (S3)

Candidate party symbols are uploaded via `POST /api/uploads` (admin session required).

Configure in the active profile (`Voting/.env.development` or `.env.production`):

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your-bucket
```

Without AWS credentials, symbol upload returns `503` — the rest of the app still runs locally.

## 4. Troubleshooting

| Issue | Fix |
|-------|-----|
| MongoDB connection failed | Start `mongod` or Compass; check `MONGODB_URI` in active profile |
| Wrong chain / guardians | `yarn env:status` then `yarn env:dev` |
| Sepolia deploy overwrote local | Sepolia only updates `.env.production` archive; `yarn env:dev` keeps local |
| Port 3000 in use | Stop other Next.js processes |
| Port 8545 in use | Kill stale Hardhat node |
| Emulator can't reach API | Use `local` flavor / `10.0.2.2:3000` |
| Physical device can't reach API | `.\scripts\run-device.ps1` (LAN) or `adb reverse` |
| vanish / db:reset blocked | Good — switch with `yarn env:dev` first |

## Project layout

```
blockvote/
├── Voting/          Next.js API + admin/guardian web UI
├── app/             Android voter app (Kotlin / Compose)
├── scripts/         dev-server, run-emulator, run-device, run-prod-apk
├── HOSTING.md       Deployment guide
└── .agents/         Agent skills context (Cursor / skills.sh)
```
