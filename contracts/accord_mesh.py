# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

import json


class AccordMesh(gl.Contract):
    platform_name: str
    rules_uri: str
    operator: Address
    next_case_id: u256
    case_ids: DynArray[u256]
    cases: TreeMap[u256, str]

    def __init__(self, platform_name: str, rules_uri: str):
        self.platform_name = platform_name
        self.rules_uri = rules_uri
        self.operator = gl.message.sender_address
        self.next_case_id = 1

    def _require_case(self, case_id: u256) -> dict:
        assert case_id in self.cases, "CASE_NOT_FOUND"
        return json.loads(self.cases[case_id])

    def _save_case(self, case_id: u256, case_doc: dict) -> None:
        self.cases[case_id] = json.dumps(case_doc)

    def _split_csv(self, raw_value: str) -> list[str]:
        items = [item.strip() for item in raw_value.split(",")]
        return [item for item in items if item != ""]

    def _has_access(self, case_doc: dict, sender_hex: str) -> bool:
        if sender_hex == case_doc["claimant"] or sender_hex == case_doc["respondent"]:
            return True
        for role_name in ["counsel", "reviewer", "regulator"]:
            if sender_hex in case_doc["roles"][role_name]:
                return True
        return False

    def _send_gen(self, recipient_hex: str, amount: int) -> None:
        if amount <= 0:
            return
        _Recipient(Address(recipient_hex)).emit_transfer(value=u256(amount), on="finalized")

    def _fetch_urls(self, urls: list[str]) -> list[dict]:
        fetched: list[dict] = []
        for url in urls:
            if isinstance(url, str) and url.strip().startswith("http"):
                try:
                    page_text = gl.nondet.web.render(url.strip(), mode="text")
                    fetched.append({"url": url.strip(), "content": str(page_text)[:3000], "status": "fetched"})
                except Exception as exc:
                    fetched.append({"url": url.strip(), "content": "", "status": f"error: {str(exc)[:200]}"})
        return fetched

    def _format_fetched(self, fetched: list[dict]) -> str:
        if not fetched:
            return "No sources fetched."
        parts = []
        for src in fetched:
            if src["status"] == "fetched":
                parts.append(f"SOURCE [{src['url']}]:\n{src['content']}")
            else:
                parts.append(f"SOURCE [{src['url']}]: FAILED ({src['status']})")
        return "\n\n".join(parts)

    # ── View Functions ──

    @gl.public.view
    def get_platform_config(self) -> dict[str, str]:
        return {
            "platform_name": self.platform_name,
            "rules_uri": self.rules_uri,
            "operator": self.operator.as_hex,
        }

    @gl.public.view
    def get_case_ids(self) -> DynArray[u256]:
        return self.case_ids

    @gl.public.view
    def get_case_count(self) -> u256:
        return self.next_case_id - 1

    @gl.public.view
    def get_case_document(self, case_id: u256) -> str:
        return self.cases[case_id]

    # ── File Dispute (claimant stakes) ──

    @gl.public.write.payable
    def file_dispute(
        self,
        case_type: str,
        title: str,
        respondent_address: str,
        claimant_statement: str,
        evidence_urls_csv: str,
        required_stake: u256,
    ) -> u256:
        assert title.strip() != "", "TITLE_REQUIRED"
        assert claimant_statement.strip() != "", "STATEMENT_REQUIRED"
        assert required_stake > u256(0), "STAKE_REQUIRED"
        assert gl.message.value == required_stake, "STAKE_MISMATCH"

        case_id = self.next_case_id
        self.next_case_id += 1
        self.case_ids.append(case_id)

        claimant_hex = gl.message.sender_address.as_hex
        respondent_hex = Address(respondent_address).as_hex
        required_stake_int = int(required_stake)

        case_doc = {
            "id": int(case_id),
            "case_type": case_type.strip(),
            "title": title.strip(),
            "stage": "STAKE_PENDING",
            "claimant": claimant_hex,
            "respondent": respondent_hex,
            "claimant_statement": claimant_statement.strip(),
            "respondent_statement": "",
            "claimant_evidence_urls": self._split_csv(evidence_urls_csv),
            "respondent_evidence_urls": [],
            "issue_map": "",
            "credibility_notes": "",
            "settlement_option_a": "",
            "settlement_option_b": "",
            "settlement_option_c": "",
            "draft_resolution": "",
            "adjudication": {
                "verdict": "",
                "confidence": "",
                "score": 0,
                "reason": "",
                "evidence_used": [],
                "fetched_sources_summary": [],
            },
            "mediation_positions": {},
            "final_terms": "",
            "escrow": {
                "required_stake_wei": required_stake_int,
                "claimant_stake_wei": required_stake_int,
                "respondent_stake_wei": 0,
                "claimant_deposited": True,
                "respondent_deposited": False,
                "total_escrow_wei": required_stake_int,
                "winner": "",
                "loser_penalty_bps": 0,
                "operator_fee_bps": 0,
                "winner_payout_wei": 0,
                "loser_refund_wei": 0,
                "operator_fee_wei": 0,
                "settled": False,
            },
            "roles": {
                "claimant": [claimant_hex],
                "respondent": [respondent_hex],
                "counsel": [],
                "reviewer": [],
                "regulator": [],
            },
            "appeals": [],
        }

        self._save_case(case_id, case_doc)
        return case_id

    # ── Fund Respondent Stake ──

    @gl.public.write.payable
    def fund_respondent_stake(self, case_id: u256) -> None:
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "STAKE_PENDING", "INVALID_STAGE"
        assert gl.message.sender_address.as_hex == case_doc["respondent"], "ONLY_RESPONDENT"

        escrow = case_doc["escrow"]
        required_stake_int = int(escrow["required_stake_wei"])
        assert escrow["respondent_deposited"] is False, "RESPONDENT_ALREADY_FUNDED"
        assert int(gl.message.value) == required_stake_int, "STAKE_MISMATCH"

        escrow["respondent_stake_wei"] = required_stake_int
        escrow["respondent_deposited"] = True
        escrow["total_escrow_wei"] = int(escrow["claimant_stake_wei"]) + required_stake_int
        case_doc["stage"] = "RESPONSE_PENDING"
        self._save_case(case_id, case_doc)

    # ── Submit Response ──

    @gl.public.write
    def submit_response(
        self,
        case_id: u256,
        respondent_statement: str,
        evidence_urls_csv: str,
    ) -> None:
        assert respondent_statement.strip() != "", "RESPONSE_REQUIRED"
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "RESPONSE_PENDING", "INVALID_STAGE"
        assert gl.message.sender_address.as_hex == case_doc["respondent"], "ONLY_RESPONDENT"
        assert case_doc["escrow"]["respondent_deposited"] is True, "RESPONDENT_STAKE_REQUIRED"

        case_doc["respondent_statement"] = respondent_statement.strip()
        case_doc["respondent_evidence_urls"] = self._split_csv(evidence_urls_csv)
        case_doc["stage"] = "ANALYSIS_READY"
        self._save_case(case_id, case_doc)

    # ── Analyze Case (on-chain evidence fetching + AI analysis) ──

    @gl.public.write
    def analyze_case(self, case_id: u256) -> None:
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "ANALYSIS_READY", "INVALID_STAGE"

        # Fetch BOTH parties' evidence URLs on-chain
        claimant_urls = case_doc.get("claimant_evidence_urls", [])
        respondent_urls = case_doc.get("respondent_evidence_urls", [])
        all_urls = claimant_urls + respondent_urls

        fetched_claimant = self._fetch_urls(claimant_urls)
        fetched_respondent = self._fetch_urls(respondent_urls)
        all_fetched = fetched_claimant + fetched_respondent

        fetched_claimant_text = self._format_fetched(fetched_claimant)
        fetched_respondent_text = self._format_fetched(fetched_respondent)

        prompt = f"""You are a neutral dispute analyst for a bilateral escrow arbitration platform.

Rules URI: {self.rules_uri}
Case type: {case_doc["case_type"]}
Title: {case_doc["title"]}

CLAIMANT STATEMENT:
{case_doc["claimant_statement"][:4000]}

RESPONDENT STATEMENT:
{case_doc["respondent_statement"][:4000]}

FETCHED CLAIMANT EVIDENCE (independently retrieved on-chain):
{fetched_claimant_text}

FETCHED RESPONDENT EVIDENCE (independently retrieved on-chain):
{fetched_respondent_text}

INSTRUCTIONS:
1. Cross-reference claimant claims against fetched claimant evidence.
2. Cross-reference respondent claims against fetched respondent evidence.
3. Check if fetched sources confirm or contradict either party's narrative.
4. Identify which party has stronger support from authoritative data.
5. Assess credibility gaps: what evidence is missing that would settle the dispute?

Return JSON with exactly these keys:
{{
  "issue_map": "bullet-style issue map identifying key factual disputes",
  "credibility_notes": "assessment of which party's evidence is stronger and why, cross-referenced against fetched sources",
  "settlement_option_a": "practical settlement path favoring claimant",
  "settlement_option_b": "practical settlement path favoring respondent",
  "settlement_option_c": "compromise / split settlement path",
  "draft_resolution": "neutral draft memo with likely fair resolution grounded in fetched evidence"
}}"""

        def nondet():
            response = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.loads(response)

        analysis = gl.eq_principle.strict_eq(nondet)
        assert isinstance(analysis, dict), "ANALYSIS_FAILED"

        case_doc["issue_map"] = str(analysis.get("issue_map", ""))[:4000]
        case_doc["credibility_notes"] = str(analysis.get("credibility_notes", ""))[:4000]
        case_doc["settlement_option_a"] = str(analysis.get("settlement_option_a", ""))[:2000]
        case_doc["settlement_option_b"] = str(analysis.get("settlement_option_b", ""))[:2000]
        case_doc["settlement_option_c"] = str(analysis.get("settlement_option_c", ""))[:2000]
        case_doc["draft_resolution"] = str(analysis.get("draft_resolution", ""))[:5000]
        case_doc["stage"] = "MEDIATION_OPEN"
        self._save_case(case_id, case_doc)

    # ── Adjudicate Dispute (leader-validator consensus verdict) ──

    @gl.public.write
    def adjudicate_dispute(self, case_id: u256) -> None:
        """Run leader-validator consensus to produce a binding verdict."""
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "MEDIATION_OPEN", "INVALID_STAGE"

        # Fetch all evidence URLs on-chain
        claimant_urls = case_doc.get("claimant_evidence_urls", [])
        respondent_urls = case_doc.get("respondent_evidence_urls", [])
        fetched_claimant = self._fetch_urls(claimant_urls)
        fetched_respondent = self._fetch_urls(respondent_urls)
        fetched_claimant_text = self._format_fetched(fetched_claimant)
        fetched_respondent_text = self._format_fetched(fetched_respondent)

        prompt = f"""You are an adjudicator for a bilateral escrow dispute on GenLayer.

CASE:
Type: {case_doc["case_type"]}
Title: {case_doc["title"]}

CLAIMANT: {case_doc["claimant_statement"][:3000]}
RESPONDENT: {case_doc["respondent_statement"][:3000]}

CLAIMANT EVIDENCE (fetched on-chain):
{fetched_claimant_text}

RESPONDENT EVIDENCE (fetched on-chain):
{fetched_respondent_text}

ANALYSIS:
Issue map: {case_doc.get("issue_map", "N/A")}
Credibility: {case_doc.get("credibility_notes", "N/A")}
Draft resolution: {case_doc.get("draft_resolution", "N/A")}

MEDIATION POSITIONS:
{json.dumps(case_doc.get("mediation_positions", {}))}

Return JSON:
{{
  "verdict": "CLAIMANT_FAVORED" | "RESPONDENT_FAVORED" | "SPLIT" | "UNDERTERMINED",
  "confidence": "high" | "medium" | "low",
  "score": 0-100,
  "reason": "concise explanation grounded in fetched evidence and analysis",
  "evidence_used": ["bullet 1", "bullet 2", "bullet 3"],
  "fetched_sources_summary": ["source 1 summary", "source 2 summary"]
}}"""

        def leader_fn() -> dict:
            response = gl.nondet.exec_prompt(prompt, response_format="json")
            result = json.loads(response)

            # Validate verdict
            verdict = str(result.get("verdict", "")).strip().upper()
            if verdict not in ("CLAIMANT_FAVORED", "RESPONDENT_FAVORED", "SPLIT", "UNDERTERMINED"):
                raise Exception(f"Invalid verdict: {verdict}")

            confidence = str(result.get("confidence", "medium")).strip().lower()
            if confidence not in ("high", "medium", "low"):
                confidence = "medium"

            score = int(round(float(str(result.get("score", 0)).strip())))
            score = max(0, min(100, score))

            reason = str(result.get("reason", "")).strip()
            if not reason:
                raise Exception("Missing reason")

            evidence_used = result.get("evidence_used", [])
            if not isinstance(evidence_used, list):
                evidence_used = []

            fetched_summary = result.get("fetched_sources_summary", [])
            if not isinstance(fetched_summary, list):
                fetched_summary = []

            return {
                "verdict": verdict,
                "confidence": confidence,
                "score": score,
                "reason": reason,
                "evidence_used": [str(e).strip() for e in evidence_used[:8]],
                "fetched_sources_summary": [str(s).strip() for s in fetched_summary[:5]],
            }

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            my_result = leader_fn()
            other = leader_result.calldata
            if not isinstance(other, dict):
                return False

            # Must agree on verdict
            if my_result["verdict"] != other.get("verdict"):
                return False

            # Confidence within 1 rank
            conf_rank = {"low": 1, "medium": 2, "high": 3}
            my_conf = conf_rank.get(my_result["confidence"], 2)
            other_conf = conf_rank.get(str(other.get("confidence", "medium")).lower(), 2)
            if abs(my_conf - other_conf) > 1:
                return False

            # Score within 20 points
            try:
                other_score = int(other.get("score", 0))
            except Exception:
                return False
            if abs(my_result["score"] - other_score) > 20:
                return False

            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # Store adjudication result
        case_doc["adjudication"] = {
            "verdict": result["verdict"],
            "confidence": result["confidence"],
            "score": result["score"],
            "reason": result["reason"],
            "evidence_used": result["evidence_used"],
            "fetched_sources_summary": result.get("fetched_sources_summary", []),
        }
        self._save_case(case_id, case_doc)

    # ── Mediation Position ──

    @gl.public.write
    def record_mediation_position(
        self,
        case_id: u256,
        option_key: str,
        rationale: str,
    ) -> None:
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "MEDIATION_OPEN", "INVALID_STAGE"

        sender = gl.message.sender_address.as_hex
        assert sender == case_doc["claimant"] or sender == case_doc["respondent"], "ONLY_PARTIES"

        if option_key not in ["A", "B", "C", "REJECT"]:
            raise Exception("INVALID_OPTION")

        case_doc["mediation_positions"][sender] = {
            "option": option_key,
            "rationale": rationale[:1000],
        }
        self._save_case(case_id, case_doc)

    # ── Assign Role ──

    @gl.public.write
    def assign_case_role(
        self,
        case_id: u256,
        role_name: str,
        assignee_address: str,
    ) -> None:
        assert role_name in ["counsel", "reviewer", "regulator"], "INVALID_ROLE"
        assert gl.message.sender_address == self.operator, "ONLY_OPERATOR"

        case_doc = self._require_case(case_id)
        assignee_hex = Address(assignee_address).as_hex

        if assignee_hex not in case_doc["roles"][role_name]:
            case_doc["roles"][role_name].append(assignee_hex)
        self._save_case(case_id, case_doc)

    # ── Submit Appeal ──

    @gl.public.write
    def submit_appeal(
        self,
        case_id: u256,
        requested_action: str,
        rationale: str,
        evidence_urls_csv: str,
    ) -> None:
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "RESOLVED", "CASE_NOT_RESOLVED"
        assert rationale.strip() != "", "RATIONALE_REQUIRED"
        assert requested_action.strip() != "", "ACTION_REQUIRED"

        sender = gl.message.sender_address.as_hex
        assert self._has_access(case_doc, sender), "NO_CASE_ACCESS"

        case_doc["appeals"].append({
            "submitted_by": sender,
            "requested_action": requested_action[:1000],
            "rationale": rationale[:3000],
            "evidence_urls": self._split_csv(evidence_urls_csv),
            "status": "PENDING_REVIEW",
            "review_memo": "",
            "reviewed_by": "",
        })
        self._save_case(case_id, case_doc)

    # ── Review Appeal ──

    @gl.public.write
    def review_appeal(
        self,
        case_id: u256,
        appeal_index: u256,
        disposition: str,
        review_memo: str,
    ) -> None:
        assert disposition in ["UPHELD", "REOPENED", "MODIFIED_TERMS"], "INVALID_DISPOSITION"
        case_doc = self._require_case(case_id)
        sender = gl.message.sender_address.as_hex

        assert (
            gl.message.sender_address == self.operator
            or sender in case_doc["roles"]["reviewer"]
            or sender in case_doc["roles"]["regulator"]
        ), "ONLY_REVIEWERS"

        idx = int(appeal_index)
        assert idx >= 0 and idx < len(case_doc["appeals"]), "INVALID_APPEAL_INDEX"

        case_doc["appeals"][idx]["status"] = disposition
        case_doc["appeals"][idx]["review_memo"] = review_memo[:3000]
        case_doc["appeals"][idx]["reviewed_by"] = sender

        if disposition == "REOPENED":
            case_doc["stage"] = "MEDIATION_OPEN"
            case_doc["escrow"]["settled"] = False

        self._save_case(case_id, case_doc)

    # ── Publish Final Terms (operator resolves + escrow settlement) ──

    @gl.public.write
    def publish_final_terms(
        self,
        case_id: u256,
        final_terms: str,
        prevailing_party: str,
        loser_penalty_bps: u256,
        operator_fee_bps: u256,
    ) -> None:
        assert gl.message.sender_address == self.operator, "ONLY_OPERATOR"
        assert prevailing_party in ["CLAIMANT", "RESPONDENT"], "INVALID_PREVAILING_PARTY"

        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "MEDIATION_OPEN", "INVALID_STAGE"
        assert final_terms.strip() != "", "FINAL_TERMS_REQUIRED"

        # Require adjudication before finalizing
        adj = case_doc.get("adjudication", {})
        assert adj.get("verdict", "") != "", "ADJUDICATION_REQUIRED"

        escrow = case_doc["escrow"]
        assert escrow["claimant_deposited"] is True, "CLAIMANT_STAKE_REQUIRED"
        assert escrow["respondent_deposited"] is True, "RESPONDENT_STAKE_REQUIRED"
        assert escrow["settled"] is False, "ALREADY_SETTLED"

        penalty_bps_int = int(loser_penalty_bps)
        fee_bps_int = int(operator_fee_bps)

        assert penalty_bps_int >= 0 and penalty_bps_int <= 10000, "INVALID_PENALTY_BPS"
        assert fee_bps_int >= 0 and fee_bps_int <= 2000, "INVALID_OPERATOR_FEE_BPS"
        assert penalty_bps_int + fee_bps_int <= 10000, "PENALTY_PLUS_FEE_TOO_HIGH"

        claimant_stake = int(escrow["claimant_stake_wei"])
        respondent_stake = int(escrow["respondent_stake_wei"])
        claimant_fee = (claimant_stake * fee_bps_int) // 10000
        respondent_fee = (respondent_stake * fee_bps_int) // 10000
        operator_fee = claimant_fee + respondent_fee

        if prevailing_party == "CLAIMANT":
            penalty_amount = (respondent_stake * penalty_bps_int) // 10000
            winner_payout = claimant_stake - claimant_fee + penalty_amount
            loser_refund = respondent_stake - respondent_fee - penalty_amount
            winner_recipient = case_doc["claimant"]
            loser_recipient = case_doc["respondent"]
        else:
            penalty_amount = (claimant_stake * penalty_bps_int) // 10000
            winner_payout = respondent_stake - respondent_fee + penalty_amount
            loser_refund = claimant_stake - claimant_fee - penalty_amount
            winner_recipient = case_doc["respondent"]
            loser_recipient = case_doc["claimant"]

        assert loser_refund >= 0, "INSUFFICIENT_LOSER_REFUND"

        self._send_gen(winner_recipient, winner_payout)
        self._send_gen(loser_recipient, loser_refund)
        self._send_gen(self.operator.as_hex, operator_fee)

        escrow["winner"] = prevailing_party
        escrow["loser_penalty_bps"] = penalty_bps_int
        escrow["operator_fee_bps"] = fee_bps_int
        escrow["winner_payout_wei"] = winner_payout
        escrow["loser_refund_wei"] = loser_refund
        escrow["operator_fee_wei"] = operator_fee
        escrow["settled"] = True
        escrow["total_escrow_wei"] = claimant_stake + respondent_stake

        case_doc["final_terms"] = final_terms.strip()[:5000]
        case_doc["stage"] = "RESOLVED"
        self._save_case(case_id, case_doc)
