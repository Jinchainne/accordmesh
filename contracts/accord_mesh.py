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

    @gl.public.view
    def get_case(self, case_id: u256) -> dict[str, str]:
        case_doc = self._require_case(case_id)
        return {
            "id": str(case_doc["id"]),
            "stage": case_doc["stage"],
            "case_type": case_doc["case_type"],
            "title": case_doc["title"],
            "claimant": case_doc["claimant"],
            "respondent": case_doc["respondent"],
            "claimant_statement": case_doc["claimant_statement"],
            "respondent_statement": case_doc["respondent_statement"],
            "issue_map": case_doc["issue_map"],
            "credibility_notes": case_doc["credibility_notes"],
            "settlement_option_a": case_doc["settlement_option_a"],
            "settlement_option_b": case_doc["settlement_option_b"],
            "settlement_option_c": case_doc["settlement_option_c"],
            "draft_resolution": case_doc["draft_resolution"],
            "final_terms": case_doc["final_terms"],
        }

    @gl.public.write
    def file_dispute(
        self,
        case_type: str,
        title: str,
        respondent_address: str,
        claimant_statement: str,
        evidence_urls_csv: str,
    ) -> u256:
        assert title.strip() != "", "TITLE_REQUIRED"
        assert claimant_statement.strip() != "", "STATEMENT_REQUIRED"

        case_id = self.next_case_id
        self.next_case_id += 1
        self.case_ids.append(case_id)

        case_doc = {
            "id": int(case_id),
            "case_type": case_type.strip(),
            "title": title.strip(),
            "stage": "RESPONSE_PENDING",
            "claimant": gl.message.sender_address.as_hex,
            "respondent": Address(respondent_address).as_hex,
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
            "mediation_positions": {},
            "final_terms": "",
        }

        self._save_case(case_id, case_doc)
        return case_id

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

        case_doc["respondent_statement"] = respondent_statement.strip()
        case_doc["respondent_evidence_urls"] = self._split_csv(evidence_urls_csv)
        case_doc["stage"] = "ANALYSIS_READY"
        self._save_case(case_id, case_doc)

    @gl.public.write
    def analyze_case(self, case_id: u256) -> None:
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "ANALYSIS_READY", "INVALID_STAGE"

        prompt = f"""
You are a neutral dispute analyst for a digital casework platform.

Rules URI: {self.rules_uri}
Case type: {case_doc["case_type"]}
Title: {case_doc["title"]}

Claimant statement:
BEGIN_CLAIMANT
{case_doc["claimant_statement"][:4000]}
END_CLAIMANT

Respondent statement:
BEGIN_RESPONDENT
{case_doc["respondent_statement"][:4000]}
END_RESPONDENT

Claimant evidence URLs:
{json.dumps(case_doc["claimant_evidence_urls"])}

Respondent evidence URLs:
{json.dumps(case_doc["respondent_evidence_urls"])}

Return JSON with exactly these keys:
{{
  "issue_map": "short bullet-style issue map",
  "credibility_notes": "brief note on missing facts and competing claims",
  "settlement_option_a": "practical settlement path A",
  "settlement_option_b": "practical settlement path B",
  "settlement_option_c": "practical settlement path C",
  "draft_resolution": "neutral draft memo summarizing likely fair resolution"
}}
"""

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

    @gl.public.write
    def publish_final_terms(self, case_id: u256, final_terms: str) -> None:
        assert gl.message.sender_address == self.operator, "ONLY_OPERATOR"
        case_doc = self._require_case(case_id)
        assert case_doc["stage"] == "MEDIATION_OPEN", "INVALID_STAGE"
        assert final_terms.strip() != "", "FINAL_TERMS_REQUIRED"

        case_doc["final_terms"] = final_terms.strip()[:5000]
        case_doc["stage"] = "RESOLVED"
        self._save_case(case_id, case_doc)
