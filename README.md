# AccordMesh

AccordMesh is a GenLayer-native dispute casework platform focused on intake, bilateral GEN escrow, evidence organization, mediation, and resolution drafting.

Live deployment:

- Frontend: https://accordmesh.vercel.app
- Studionet contract: `0x4f4EdcAf1d8Fe65523aB0FEb92F79D17Cc9140FE`

This repo is intentionally designed to be structurally and conceptually different from verdict-and-betting dispute apps. The MVP centers on phased casework:

1. Claimant files a dispute and posts GEN stake
2. Respondent matches the GEN stake to contest the claim
3. Respondent response collection
4. AI-generated issue map and mediation options
5. Resolution memo drafting and escrow settlement

## Architecture

- `contracts/accord_mesh.py`
  - GenLayer Intelligent Contract
  - Stores dispute records as serialized case documents
  - Enforces the dispute + escrow state machine
  - Holds bilateral GEN stake and settles payout on operator ruling
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

1. Claimant files a dispute with type, title, narrative, evidence links, and matching GEN stake
2. Respondent matches the required GEN stake and submits a response with supporting links
3. Anyone authorized to operate the case runs AI analysis
4. The contract stores:
   - issue map
   - credibility notes
   - three settlement options
   - a draft resolution memo
5. Parties can record their mediation position
6. Operator settles the dispute by choosing the prevailing side, loser penalty, and operator fee
7. Case is marked resolved once the final terms and payout split are published

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
- claimant/respondent bilateral GEN escrow
- winner/loser/operator payout settlement logic

## GenLayer network notes

According to the current GenLayer docs, `studionet` is the hosted development environment and the contract can be deployed directly with:

```powershell
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

## Production notes

- The live Studionet contract deployed on July 31, 2026 is `0x4f4EdcAf1d8Fe65523aB0FEb92F79D17Cc9140FE`.
- Frontend fallback config now points to this contract by default.
