# AccordMesh

Bilateral escrow dispute resolution on GenLayer — AI-powered adjudication, mediation, and escrow settlement.

**Live:** https://accordmesh.vercel.app/  
**Contract:** `0x7a31F66E3EE60AB37bD39B8572B3344aE23f467b` (StudioNet 61999)  
**Explorer:** https://explorer-studio.genlayer.com/address/0x7a31F66E3EE60AB37bD39B8572B3344aE23f467b  
**Deploy TX:** https://explorer-studio.genlayer.com/tx/0xce5cb9a1fe0bdcf840b02c9c77f8e70d21611a62f28733d0bd9f374c3176ee0e

## How It Works

```
Buyer files dispute  →  Seller matches escrow  →  AI analyzes evidence  →  Adjudicate  →  Mediate  →  Final Terms
+ deposits GEN            + deposits GEN            (on-chain fetch)         (consensus)     (A/B/C)     (settlement)
                                                    ↓ INSIDE consensus       ↓ verdict binds
                                                    both leader &            payout outcome
                                                    validator fetch
```

### 1. File Dispute (Claimant) — `@gl.public.write.payable`
- Files a dispute with case type, title, respondent, statement, and evidence URLs
- **Sends real GEN as escrow** via `gl.message.value`
- Sets a 500-block deadline for respondent to fund

### 2. Claimant Withdraw (Timeout) — `@gl.public.write`
- If respondent doesn't fund within 500 blocks, claimant can reclaim their stake
- Prevents escrow from being stranded indefinitely

### 3. Fund Stake (Respondent) — `@gl.public.write.payable`
- Respondent deposits matching GEN escrow before deadline
- Dispute moves to RESPONSE_PENDING

### 4. Submit Response — `@gl.public.write`
- Respondent submits defense statement and evidence URLs
- Dispute moves to ANALYSIS_READY

### 5. Analyze Case — `@gl.public.write`
- AI fetches evidence URLs from both parties **inside the consensus path**
- Both leader and validator independently fetch via `gl.nondet.web.render()`
- Generates issue map, credibility notes, settlement options, draft resolution
- Uses `gl.eq_principle.strict_eq` consensus
- Dispute moves to MEDIATION_OPEN

### 6. Adjudicate — `@gl.public.write`
- **Leader-validator consensus** via `gl.vm.run_nondet_unsafe()`
- Both nodes independently fetch evidence **inside the consensus function**
- Consensus: verdict exact match, score ±20, confidence ±1 rank
- Produces binding verdict: `CLAIMANT_FAVORED` / `RESPONDENT_FAVORED` / `SPLIT` / `UNDETERMINED`

### 7. Mediation — `@gl.public.write`
- Both parties choose: Option A, B, C, or REJECT
- Positions recorded on-chain

### 8. Final Terms — `@gl.public.write`
- Operator finalizes — **payout is derived from consensus verdict, not operator choice**
- `publish_final_terms` does NOT accept `prevailing_party` — the verdict determines the winner
- Escrow settlement via `emit_transfer`:
  - `CLAIMANT_FAVORED`: claimant gets stake + penalty from respondent
  - `RESPONDENT_FAVORED`: respondent gets stake + penalty from claimant
  - `SPLIT`: both parties get own stake back minus fees, no penalty
  - `UNDETERMINED`: full refund to both, no operator fee

### 9. Appeal — `@gl.public.write`
- Either party can appeal after resolution with new evidence
- Reviewer can: UPHELD (reject appeal), REOPENED (re-run analysis + adjudication), or MODIFIED_TERMS
- REOPENED goes to ANALYSIS_READY with previous adjudication cleared for fresh consensus

## Contract Functions

### Write (payable — sends GEN)
| Function | Description |
|----------|-------------|
| `file_dispute(type, title, respondent, statement, evidence_csv, stake)` | Claimant files dispute + deposits escrow |
| `fund_respondent_stake(case_id)` | Respondent matches escrow (before deadline) |

### Write (no value)
| Function | Description |
|----------|-------------|
| `claimant_withdraw(case_id)` | Claimant reclaims stake if respondent missed deadline |
| `submit_response(case_id, statement, evidence_csv)` | Respondent submits defense |
| `analyze_case(case_id)` | AI analysis with on-chain evidence fetching (inside consensus) |
| `adjudicate_dispute(case_id)` | Leader-validator consensus verdict |
| `record_mediation_position(case_id, option, rationale)` | Party mediation choice |
| `publish_final_terms(case_id, terms, penalty, fee)` | Settle escrow — verdict determines winner |
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
class AccordMesh(gl.Contract):
    platform_name: str
    rules_uri: str
    operator: Address
    next_case_id: u256
    case_ids: DynArray[u256]
    cases: TreeMap[u256, str]
    # Key patterns:
    # - gl.nondet.web.render() INSIDE consensus for evidence fetching
    # - gl.nondet.exec_prompt() for AI analysis
    # - gl.eq_principle.strict_eq() for analysis consensus
    # - gl.vm.run_nondet_unsafe() for leader-validator adjudication
    # - Address.emit_transfer() for escrow settlement
    # - Verdict binds payout — operator cannot override
    # - 500-block deadline for respondent funding
    # - claimant_withdraw() for timeout refund
```

## Tests

38 invariant tests covering:
- Payout binding to consensus verdict (no operator override)
- Safe refund for unmatched cases (claimant_withdraw + deadline)
- Appeal accounting (REOPENED → ANALYSIS_READY, clears adjudication)
- Web retrieval inside consensus path (leader_fn/nondet)
- Escrow invariants (settled flag, u256 transfers, positive amounts)
- Stage transitions (STAKE_PENDING → RESPONSE_PENDING → ANALYSIS_READY → MEDIATION_OPEN → RESOLVED)
- Consensus primitives (run_nondet_unsafe, eq_principle, exec_prompt, web.render)
- Access control (operator-only, respondent-only, claimant-only)

```bash
python -m pytest tests/test_contract_invariants.py -v
```

## Frontend

- **Next.js** + React + TypeScript + Tailwind CSS
- Dark-mode design
- Case queue with search and stage filters
- 7-step workflow stepper
- RPC proxy (`/api/rpc`) for CORS bypass
- Wallet connection: OKX / MetaMask via `window.ethereum`
- StudioNet chain (0xf22f / 61999)
- Verdict displayed from consensus (no operator dropdown)

## Quick Start

```bash
# Install
cd frontend && npm install

# Run dev
npm run dev

# Build
npm run build

# Deploy contract (no args — constructor uses defaults)
genlayer deploy --contract contracts/accord_mesh.py
```

## Project Structure

```
├── contracts/
│   └── accord_mesh.py           # GenLayer Intelligent Contract (680 lines)
├── tests/
│   └── test_contract_invariants.py  # 38 invariant tests
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Main dashboard component
│   │   ├── globals.css          # Dark-mode styles
│   │   ├── layout.tsx           # Root layout
│   │   └── api/rpc/route.ts     # RPC proxy for CORS
│   ├── lib/
│   │   ├── contracts/accordMesh.ts   # Contract client
│   │   ├── genlayer/client.ts        # GenLayer RPC client
│   │   ├── genlayer/config.ts        # Chain config + contract address
│   │   └── services/dispute-service.ts
│   └── components/
├── deploy/
├── vercel.json
└── README.md
```

## Why GenLayer?

This project **cannot work without GenLayer**:
- AI must fetch and analyze real evidence on-chain (`gl.nondet.web.render` inside consensus)
- No single entity should decide a dispute alone (leader-validator consensus)
- Real GEN escrow creates financial incentive for honest participation
- `emit_transfer` provides trustless settlement without intermediaries
- Bilateral escrow ensures both parties have skin in the game
- Verdict binds payout — removes operator discretion from settlement

## Author

- **Jinchainne** — [GitHub](https://github.com/Jinchainne)
