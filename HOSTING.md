# BlockVote Hosting Guide

Deploy the Next.js backend, configure S3 for party symbols, and distribute the Android voter app.

## Architecture overview

```
Voters (Android) ──► Next.js API (Vercel or AWS) ──► MongoDB Atlas
                              │
                              ├──► Ethereum RPC (Alchemy / Infura)
                              ├──► AWS S3 (party symbols, photos)
                              └──► AWS Rekognition (biometric)
Guardians / Admins ──► Web UI (Fluent UI) on same Next.js deployment
```

---

## Option A: Vercel (recommended for Next.js)

### 1. Prepare the repository

- Root directory for deployment: **`Voting/`**
- Framework preset: **Next.js**
- Build command: `yarn build`
- Output: default (`.next`)

### 2. Environment variables

Set these in the Vercel project dashboard (Production + Preview):

| Variable | Required | Notes |
|----------|----------|-------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `AUTH_SECRET` | Yes | Random 32+ char string |
| `JWT_SECRET` | Yes | Session / token signing |
| `SERVER_IDENTITY_SECRET` | Yes | Voter identity HMAC |
| `NEXTAUTH_URL` | Yes | `https://your-domain.vercel.app` |
| `RPC_URL` | Yes | Sepolia/mainnet RPC (Alchemy) |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Yes | Deployed proxy address |
| `RELAYER_PRIVATE_KEY` | Yes | Gasless vote relay wallet |
| `GAS_STATION_PRIVATE_KEY` | Yes | Bulk registration wallet |
| `AWS_REGION` | Yes | e.g. `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | Yes | IAM user with S3 write |
| `AWS_SECRET_ACCESS_KEY` | Yes | |
| `AWS_S3_BUCKET` | Yes | Party symbol bucket |
| `AWS_S3_PUBLIC_URL` | Optional | CloudFront URL |
| `RESEND_API_KEY` | Yes | Voter invite / OTP email |
| `RESEND_FROM_EMAIL` | Yes | Verified sender domain |
| `PINATA_JWT` | Optional | IPFS metadata pinning |

Do **not** commit `.env` files.

### 3. Deploy

```bash
cd Voting
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard with root directory `Voting`.

### 4. Post-deploy

1. Run contract deploy to Sepolia: `yarn deploy:sepolia`
2. Set `NEXT_PUBLIC_CONTRACT_ADDRESS` in Vercel
3. Fund relayer wallets with Sepolia ETH
4. Verify `/api/preflight` returns healthy status

---

## Option B: AWS

See also `Voting/DEPLOYMENT_AWS.md` for EC2, ECS Fargate, and Amplify details.

### Minimal EC2 path

1. **MongoDB Atlas** — create cluster, allow EC2 IP in network access.
2. **EC2** — Ubuntu 22.04, `t3.small` or larger.
3. Install Node 20, clone repo, `cd Voting && yarn install && yarn build`.
4. Use **PM2** or systemd to run `yarn start` on port 3000.
5. **ALB + ACM** — HTTPS termination, health check `/api/preflight`.
6. **Route 53** — point domain to ALB.

Hardhat is **not** run in production; use Alchemy/Infura `RPC_URL` and a pre-deployed contract.

---

## AWS S3 — party symbol images

### Bucket setup

1. Create bucket (e.g. `blockvote-assets-prod`) in your region.
2. Block public access **off** for object reads, or use CloudFront OAC.
3. Bucket policy (public read example):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadPartySymbols",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::blockvote-assets-prod/party-symbols/*"
  }, {
    "Sid": "PublicReadCandidates",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::blockvote-assets-prod/candidates/*"
  }]
}
```

4. IAM user for the Next.js app:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:PutObjectAcl"],
    "Resource": "arn:aws:s3:::blockvote-assets-prod/*"
  }]
}
```

### API

- `POST /api/uploads` — multipart `file` + optional `folder` (`party-symbols/{org}`, `candidates/{org}`)
- Requires admin session (NextAuth)
- Returns `{ url: "https://..." }` stored in on-chain `symbol` field

### CSP

`Voting/middleware.js` allows `https://*.amazonaws.com` in `img-src`. Add your CloudFront domain if used:

```
img-src ... https://your-cdn.cloudfront.net
```

---

## Android app distribution

The Android app is **not** hosted on Vercel/AWS — voters install it locally or via your own distribution channel.

### Build release APK/AAB

```powershell
cd C:\Users\Devil\Desktop\blockvote
.\gradlew.bat bundleRelease -PapiBaseUrl=https://your-api.example.com/
```

Set `apiBaseUrl` to your production Next.js URL (must be HTTPS).

### Store / sideload options

| Channel | Notes |
|---------|-------|
| Google Play | Sign with release keystore; set `API_BASE_URL` in `build.gradle.kts` or `-PapiBaseUrl` |
| Internal testing | Firebase App Distribution or direct APK |
| Local dev | `run-emulator.ps1` / `run-device.ps1` (see `RUNNING.md`) |

### Production checklist

- [ ] HTTPS API URL baked into release build
- [ ] Deep links: `blockvote://vote/{electionId}` configured in `AndroidManifest.xml`
- [ ] Network security config allows your API domain only
- [ ] Biometric / camera permissions documented for store review

---

## Environment variable reference (quick)

```env
# Core
MONGODB_URI=
AUTH_SECRET=
JWT_SECRET=
SERVER_IDENTITY_SECRET=
NEXTAUTH_URL=

# Chain
RPC_URL=
NEXT_PUBLIC_CONTRACT_ADDRESS=
RELAYER_PRIVATE_KEY=
GAS_STATION_PRIVATE_KEY=

# S3
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_S3_PUBLIC_URL=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

---

## Credentials you must provide

| Service | Who provides |
|---------|--------------|
| Vercel account / project | You |
| MongoDB Atlas URI | You |
| AWS IAM + S3 bucket | You |
| Alchemy/Infura RPC + deploy wallet | You |
| Resend API key + domain | You |
| Google Play signing keystore | You (for store release) |

The codebase includes scripts and API routes; cloud accounts and secrets are not bundled.

---

## Related docs

- [RUNNING.md](./RUNNING.md) — local backend + Android
- [Voting/DEPLOYMENT_AWS.md](./Voting/DEPLOYMENT_AWS.md) — detailed AWS options
- [Voting/.env.example](./Voting/.env.example) — full env template
