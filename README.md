# AccordMesh

AccordMesh is a GenLayer-native dispute casework platform focused on intake, evidence organization, mediation, and resolution drafting.

Live deployment:

- Frontend: https://accordmesh.vercel.app
- Studionet contract: `0x5187c794213c17Ab3E3e4Aa1EB9E7d9DD19BEC2b`

This repo is intentionally designed to be structurally and conceptually different from verdict-and-betting dispute apps. The MVP centers on phased casework:

1. Intake and structured dispute filing
2. Respondent response collection
3. AI-generated issue map and mediation options
4. Resolution memo drafting

## Architecture

- `contracts/accord_mesh.py`
  - GenLayer Intelligent Contract
  - Stores dispute records as serialized case documents
  - Enforces the dispute state machine
  - Runs AI analysis for issue mapping and settlement options
- `frontend/`
  - Next.js App Router frontend
  - Includes wallet connection, intake, response, analysis, mediation, and final-terms flows
  - Supports both `mock` mode and live GenLayer interaction through `genlayer-js`
- `deploy/`
  - Simple deployment helper for Studionet / GenLayer Studio
- `docs/architecture.md`
  - Domain model and workflow rationale

## Why this is different

AccordMesh is not a token betting market and not an "AI criminal court."

The product models a real dispute workflow more like legal operations:

- structured claim intake
- evidence normalization
- issue spotting
- mediation options
- resolution memo generation

## Originality boundary

This project is built as a separate product concept with:

- a different product thesis
- a different contract model
- a different workflow
- different seed data
- different interface copy
- no imported assets, content, or repository data from earlier examples

## MVP workflow

1. Claimant files a dispute with type, title, narrative, and evidence links
2. Respondent submits a response and supporting links
3. Anyone authorized to operate the case runs AI analysis
4. The contract stores:
   - issue map
   - credibility notes
   - three settlement options
   - a draft resolution memo
5. Parties can record their mediation position
6. Case can be marked resolved once the operator publishes final terms

## Current project status

This repo now includes:

- a deployable GenLayer Intelligent Contract
- a client-side Next.js workspace
- browser wallet connection for signed writes
- read + write integration through the official `genlayer-js` SDK
- mock mode for UI iteration before deployment
- live mode for Studionet once a contract address is configured
- a regulatory submission packet export for post-resolution reporting
- evidence upload routes for IPFS via Pinata and Google Drive via service account
- role assignment for counsel, reviewer, and regulator
- appeal filing and appeal review workflows
- PDF-ready decision memo output

## GenLayer network notes

According to the current GenLayer docs, `studionet` is the hosted development environment and can be targeted via the CLI with:

```powershell
genlayer network studionet
genlayer deploy --contract contracts/accord_mesh.py
```

GenLayer also documents direct deployment to `https://studio.genlayer.com/api` for Studionet.

## Quick start

### 1. Install prerequisites

- Node.js 18+
- Python 3.12+
- GenLayer CLI

```powershell
npm install -g genlayer
```

### 2. Install frontend dependencies

```powershell
cd frontend
npm install
```

### 3. Configure the frontend

```powershell
Copy-Item .env.example .env.local
```

Set:

- `NEXT_PUBLIC_GENLAYER_RPC_URL`
- `NEXT_PUBLIC_GENLAYER_NETWORK`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_APP_MODE`

Use:

- `NEXT_PUBLIC_APP_MODE=mock` while designing locally
- `NEXT_PUBLIC_APP_MODE=live` after deploying the contract

### 4. Run the app

```powershell
cd frontend
npm run dev
```

### 5. Deploy the contract

```powershell
genlayer network studionet
genlayer deploy --contract contracts/accord_mesh.py --args "AccordMesh" "ipfs://community-rules"
```

Then paste the deployed contract address into `frontend/.env.local`:

```powershell
NEXT_PUBLIC_APP_MODE=live
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

### 6. Connect wallet in the browser

The frontend uses the official GenLayer SDK pattern documented by GenLayer:

- a read client pointed at the RPC
- a write client signed by the browser wallet
- `client.connect("studionet")` to switch MetaMask to the correct chain before sending transactions

Official references:

- GenLayer JS SDK: https://docs.genlayer.com/api-references/genlayer-js
- Writing to Intelligent Contracts: https://docs.genlayer.com/developers/decentralized-applications/writing-data
- Network configuration: https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration

## Next build steps

- add evidence upload/storage strategy
- add counsel roles and reviewer roles
- add appeal requests and sealed evidence lanes
