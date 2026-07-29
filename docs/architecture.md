# AccordMesh Architecture

## Product thesis

AccordMesh treats dispute resolution as phased legal operations instead of a one-shot verdict engine.

That means the repo is built around:

- procedural stages
- structured evidence
- issue mapping
- mediation-first outcomes
- explainable resolution drafts

## Core domain objects

### Dispute record

A dispute contains:

- dispute type
- title
- claimant address
- respondent address
- claimant statement
- respondent statement
- claimant evidence links
- respondent evidence links
- current stage
- issue map
- credibility notes
- settlement options
- mediation responses
- draft resolution memo
- published final terms

### Stages

- `INTAKE`
- `RESPONSE_PENDING`
- `ANALYSIS_READY`
- `MEDIATION_OPEN`
- `RESOLVED`

## Contract design

The contract stores each case as a serialized JSON document in a `TreeMap[u256, str]`.

This avoids a deep storage schema early in the MVP and keeps iteration fast while the product model evolves. The state machine is still enforced on-chain.

### Contract responsibilities

- create cases
- validate who may respond
- validate stage transitions
- run GenLayer AI analysis
- persist analysis artifacts
- store mediation choices
- publish final terms

### AI output shape

The AI step returns JSON with:

- `issue_map`
- `credibility_notes`
- `settlement_option_a`
- `settlement_option_b`
- `settlement_option_c`
- `draft_resolution`

## Frontend design

The frontend is intentionally decoupled from the contract storage layout.

Layers:

- `lib/domain`
  - shared app types
- `lib/genlayer`
  - RPC configuration
- `lib/contracts`
  - contract-facing methods
- `lib/services`
  - service layer that can switch between mock and on-chain backends
- `components`
  - UI widgets for filing, stage board, and case review

## MVP implementation strategy

### Phase 1

- mock-first frontend
- deployable GenLayer contract
- typed service abstraction

### Phase 2

- wallet writes
- live reads from deployed contract
- evidence bundles and attachments

### Phase 3

- multi-role access
- appeals
- policy packs per dispute type

