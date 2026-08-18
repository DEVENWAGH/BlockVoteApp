# BlockVote — Architecture (Admin Web + Mobile Voting)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ANDROID APP (voters)   Invite / deep link → email → rotate scan + face  │
│  WEB BETA (computers)   /portal → email → direct camera → ballot → OTP   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS / JSON
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              NEXT.JS BFF  (Voting/app/api/*)                               │
│  Admin CRUD · OTP · Biometric JWT · Relay vote · Audit                    │
└───────┬──────────┬──────────┬──────────┬──────────┬──────────────────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
   MongoDB     Resend     AWS          Pinata     ethers relay wallet
   (Admin,     (invite,   Rekognition  / ImageKit  ──RPC──► VotingV3
    Election,   OTP,                                         (Sepolia /
    Voter…)     receipt)                                     Hardhat)
```

## Product split

| Surface | Who | What |
|---------|-----|------|
| **Web admin** (`Voting/`) | Election admins + guardians | Create elections, candidates, CSV roster, approve go-live, gas, analytics |
| **Android app** | Voters | Cast votes with surrounding / motion liveness |
| **Web beta** (`/portal`) | Voters on a computer | Same ballot APIs; **direct camera capture** (no surrounding monitor) |

Organizations are **removed**. Admins own elections via `createdBy`. Voters are scoped by `electionId` + `email`.

## Voter links

- HTTPS invite: `{APP_URL}/go/{electionId}` → Android browsers open `blockvote://vote/{electionId}`
- Web beta: `{APP_URL}/portal` and `{APP_URL}/portal/{electionId}` (desktop; phones are sent to the app)
- Custom scheme: `blockvote://vote/{electionId}`
- CSV upload auto-emails invite links; dashboard copies the same URL when voting is live
- Legacy `/vote/*` redirects to `/portal/*`

## Mobile API sequence

1. `GET /api/elections/{electionId}` — must be phase=1 + guardianApproved  
2. `GET /api/org/admin/elections/{electionId}/candidates` (legacy path; slug ignored)  
3. `GET /api/voters/lookup?email=&electionId=` → `nullifierHash`  
4. **App liveness scan** — front camera; user stays in oval; phone rotation tracked via sensors (~320° progress bar); ML Kit blocks if another person appears; auto-capture then `POST /api/biometric/verify` (AWS Rekognition)  
5. `POST /api/auth/send-otp` `{ email, electionId }`  
6. `POST /api/auth/verify-otp` + `x-biometric-token` → relay cast  
7. `GET /api/audit/verify?txHash=`

Nullifier: `keccak256(email:SERVER_IDENTITY_SECRET)` (no org).

Identity for now: **email roster + face biometric + OTP**. DigiLocker is a future plan (partner/GST required).

## Local MongoDB (Compass)

Scripts do **not** start Docker Mongo. Run local `mongod` and connect Compass to `mongodb://127.0.0.1:27017`. Set in `Voting/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/blockvote
```

## Configure API base URL

In `app/build.gradle.kts`:

- Emulator → `http://10.0.2.2:3000/` (`-PapiBaseUrl=...`)
- Device → `adb reverse` + `http://127.0.0.1:3000/` or LAN IP  
- Production → your Voting host  

Set `USE_DEMO_DATA=false` to hit real APIs.

## Dev scripts

```powershell
# Terminal 1 — backend (Mongo must already be running for Compass)
.\scripts\dev-all.ps1 server

# Terminal 2 — app
.\scripts\dev-all.ps1 emulator
# or
.\scripts\dev-all.ps1 device
```
