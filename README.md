# AccordMesh

Bilateral escrow dispute resolution on GenLayer — AI-powered adjudication, mediation, and escrow settlement.

**Live:** https://accordmesh.vercel.app/  
**Contract:** `0xf7F8b355543cE3730264e338039da1bA148420C3` (Studionet 61999)

## How It Works

```
Buyer files dispute  →  Seller matches escrow  →  AI analyzes evidence  →  Adjudicate  →  Mediate  →  Final Terms
+ deposits GEN            + deposits GEN            (on-chain fetch)         (consensus)     (A/B/C)     (settlement)
```

### 1. File Dispute (Claimant) — `@gl.public.write.payable`
- Files a dispute with case type, title, respondent, statement, and evidence URLs
- **Sends real GEN as escrow** via `gl.message.value`

### 2. Fund Stake (Respondent) — `@gl.public.write.payable`
- Respondent deposits matching GEN escrow
- Dispute moves to RESPONSE_PENDING

### 3. Submit Response — `@gl.public.write`
- Respondent submits defense statement and evidence URLs
- Dispute moves to ANALYSIS_READY

### 4. Analyze Case — `@gl.public.write`
- AI fetches evidence URLs from both parties on-chain via `gl.nondet.web.render()`
- Generates issue map, credibility notes, settlement options, draft resolution
- Uses `gl.eq_principle.strict_eq` consensus
- Dispute moves to MEDIATION_OPEN

### 5. Adjudicate — `@gl.public.write`
- **Leader-validator consensus** via `gl.vm.run_nondet_unsafe()`
- Both nodes independently fetch evidence and evaluate
- Consensus: verdict exact match, score ±20, confidence ±1 rank
- Produces verdict: `CLAIMANT_FAVORED` / `RESPONDENT_FAVORED` / `SPLIT` / `UNDERTERMINED`

### 6. Mediation — `@gl.public.write`
- Both parties choose: Option A, B, C, or REJECT
- Positions recorded on-chain

### 7. Final Terms — `@gl.public.write`
- Operator resolves dispute
- **Requires adjudication before finalizing**
- Escrow settlement via `emit_transfer`:
  - Winner gets their stake + penalty from loser
  - Loser gets their stake minus penalty
  - Operator fee deducted from both sides

## Contract Functions

### Write (payable — sends GEN)
| Function | Description |
|----------|-------------|
| `file_dispute(type, title, respondent, statement, evidence_csv, stake)` | Claimant files dispute + deposits escrow |
| `fund_respondent_stake(case_id)` | Respondent matches escrow |

### Write (no value)
| Function | Description |
|----------|-------------|
| `submit_response(case_id, statement, evidence_csv)` | Respondent submits defense |
| `analyze_case(case_id)` | AI analysis with on-chain evidence fetching |
| `adjudicate_dispute(case_id)` | Leader-validator consensus verdict |
| `record_mediation_position(case_id, option, rationale)` | Party mediation choice |
| `publish_final_terms(case_id, terms, party, penalty, fee)` | Operator resolves + settles escrow |
| `submit_appeal(case_id, action, rationale, evidence_csv)` | Appeal with new evidence |
| `review_appeal(case_id, index, disposition, memo)` | Reviewer decides appeal |

### Read (view)
| Function | Description |
|----------|-------------|
| `get_case_document(case_id)` | Get full case JSON |
| `get_case_ids()` | List all case IDs |
| `get_case_count()` | Total cases |
| `get_platform_config()` | Platform name, rules, operator |

## Contract Architecture

```python
# GenLayer Intelligent Contract (Python)
class AccordMesh(gl.Contract):
    platform_name: str
    rules_uri: str
    operator: Address
    next_case_id: u256
    case_ids: DynArray[u256]
    cases: TreeMap[u256, str]
    # Key patterns:
    # - gl.nondet.web.render() for evidence fetching
    # - gl.nondet.exec_prompt() for AI analysis
    # - gl.eq_principle.strict_eq() for analysis consensus
    # - gl.vm.run_nondet_unsafe() for leader-validator adjudication
    # - Address.emit_transfer() for escrow settlement
```

## Frontend

- **Next.js** + React + TypeScript + Tailwind CSS
- Dark-mode "Cybernetic Law Lab" design
- Case queue with search and stage filters (All Stages, Open, Analysis, Mediation)
- 7-step workflow stepper
- RPC proxy (`/api/rpc`) for CORS bypass
- Wallet connection: OKX / MetaMask via `window.ethereum`
- Studionet chain (0xf22f / 61999)

## Quick Start

```bash
# Install
cd frontend && npm install

# Run dev
npm run dev

# Build
npm run build

# Deploy contract
genlayer deploy --contract contracts/accord_mesh.py --args "AccordMesh" "ipfs://community-rules"
```

## Project Structure

```
├── contracts/
│   └── accord_mesh.py           # GenLayer Intelligent Contract
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Main dashboard component
│   │   ├── globals.css          # Dark-mode styles
│   │   ├── layout.tsx           # Root layout
│   │   └── api/rpc/route.ts     # RPC proxy for CORS
│   ├── lib/
│   │   ├── contracts/accordMesh.ts   # Contract client
│   │   ├── genlayer/client.ts        # GenLayer RPC client
│   │   ├── genlayer/config.ts        # Chain config
│   │   └── services/dispute-service.ts
│   └── components/
├── deploy/
├── vercel.json
└── README.md
```

## Why GenLayer?

This project **cannot work without GenLayer**:
- AI must fetch and analyze real evidence on-chain (`gl.nondet.web.render`)
- No single entity should decide a dispute alone (leader-validator consensus)
- Real GEN escrow creates financial incentive for honest participation
- `emit_transfer` provides trustless settlement without intermediaries
- Bilateral escrow ensures both parties have skin in the game
