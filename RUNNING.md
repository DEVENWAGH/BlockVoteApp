# Running BlockVote Locally

Guide for starting the Next.js backend and Android voter app on Windows.

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
copy .env.example .env
# Edit .env — at minimum set MONGODB_URI, JWT_SECRET, SERVER_IDENTITY_SECRET, AUTH_SECRET

yarn install
```

Ensure MongoDB is running locally:

```
mongodb://127.0.0.1:27017/blockvote
```

### Start (recommended script)

From the repo root:

```powershell
.\scripts\dev-server.ps1
```

This runs `yarn dev` in `Voting/`, which:

1. Starts Hardhat node on `http://127.0.0.1:8545`
2. Deploys the voting contract
3. Starts Next.js on `http://0.0.0.0:3000`

### Next.js only (no Hardhat)

If Hardhat is already running elsewhere:

```powershell
cd Voting
yarn dev:next-only
```

### Verify

- Landing page: http://localhost:3000
- Admin dashboard: http://localhost:3000/dashboard (after signup/login)
- Guardian portal: http://localhost:3000/admin (MetaMask + guardian wallet)

## 2. Android app

### Emulator (talks to host via `10.0.2.2`)

With the backend running:

```powershell
.\scripts\run-emulator.ps1
```

Builds `installDebug` with `-PapiBaseUrl=http://10.0.2.2:3000/` and launches the app.

### Physical device (USB)

1. Enable USB debugging on the device.
2. Start backend on your PC.
3. Forward port 3000:

```powershell
adb reverse tcp:3000 tcp:3000
```

4. Install:

```powershell
.\scripts\run-device.ps1
```

Uses `http://127.0.0.1:3000/` as the API base URL.

### Deep link test

```powershell
adb shell am start -a android.intent.action.VIEW -d "blockvote://vote/<electionId>"
```

Or open the web invite link: `http://localhost:3000/go/<electionId>`

## 3. Party symbol uploads (S3)

Candidate party symbols are uploaded via `POST /api/uploads` (admin session required).

Configure in `Voting/.env`:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your-bucket
```

Bucket policy must allow public `GetObject` on `party-symbols/*` and `candidates/*`, or set `AWS_S3_PUBLIC_URL` to a CloudFront distribution.

Without AWS credentials, symbol upload returns `503` — the rest of the app still runs locally.

## 4. Troubleshooting

| Issue | Fix |
|-------|-----|
| MongoDB connection failed | Start `mongod` or Compass; check `MONGODB_URI` |
| Port 3000 in use | Stop other Next.js processes |
| Port 8545 in use | Kill stale Hardhat node |
| Emulator can't reach API | Use `10.0.2.2:3000`, not `localhost` |
| Physical device can't reach API | Run `adb reverse tcp:3000 tcp:3000` |
| Gradle / SDK errors | Open project in Android Studio once; sync SDK |

## Project layout

```
blockvote/
├── Voting/          Next.js API + admin/guardian web UI
├── app/             Android voter app (Kotlin / Compose)
├── scripts/         dev-server.ps1, run-emulator.ps1, run-device.ps1
├── HOSTING.md       Deployment guide
└── .agents/         Agent skills context (Cursor / skills.sh)
```
