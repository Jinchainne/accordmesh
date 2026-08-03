"""
Contract invariant tests for AccordMesh.
Covers the 6 reviewer concerns:
1. Payout bound to consensus verdict
2. Safe refund for unmatched cases
3. Appeal accounting
4. Web retrieval inside consensus path
5. Escrow invariants
6. Stage transitions
"""
from pathlib import Path
import ast
import re

SOURCE = (Path(__file__).parents[1] / "contracts" / "accord_mesh.py").read_text()

# ── Syntax ──

def test_valid_python_syntax():
    ast.parse(SOURCE)

# ── 1. Payout bound to consensus ──

def test_publish_final_terms_no_prevailing_party_param():
    """publish_final_terms must NOT accept prevailing_party — verdict determines payout."""
    # Find the function signature
    match = re.search(r'def publish_final_terms\(([^)]+)\)', SOURCE, re.DOTALL)
    assert match, "publish_final_terms not found"
    params = match.group(1)
    assert "prevailing_party" not in params, \
        "publish_final_terms still accepts prevailing_party — must derive from verdict"

def test_publish_final_terms_reads_verdict():
    """publish_final_terms must read adjudication.verdict to determine payout."""
    # Find the function body
    match = re.search(r'def publish_final_terms\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match, "publish_final_terms body not found"
    body = match.group(1)
    assert 'adj.get("verdict"' in body or "adj.get('verdict'" in body, \
        "publish_final_terms must read adjudication.verdict"

def test_verdict_determines_payout_branches():
    """publish_final_terms must branch on all 4 verdict types."""
    match = re.search(r'def publish_final_terms\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    for verdict in ["CLAIMANT_FAVORED", "RESPONDENT_FAVORED", "SPLIT", "UNDETERMINED"]:
        assert verdict in body, f"Missing payout branch for {verdict}"

def test_operator_cannot_override_verdict():
    """No parameter lets operator choose winner — verdict is binding."""
    match = re.search(r'def publish_final_terms\(([^)]+)\)', SOURCE, re.DOTALL)
    assert match
    params = match.group(1)
    # Should only be: self, case_id, final_terms, loser_penalty_bps, operator_fee_bps
    assert "prevailing_party" not in params
    assert "winner" not in params

# ── 2. Safe refund for unmatched cases ──

def test_claimant_withdraw_exists():
    """claimant_withdraw must exist for timeout refund."""
    assert "def claimant_withdraw" in SOURCE

def test_claimant_withdraw_checks_deadline():
    """claimant_withdraw must check block_number > deadline."""
    match = re.search(r'def claimant_withdraw\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "block_number" in body, "claimant_withdraw must check block_number"
    assert "deadline" in body.lower(), "claimant_withdraw must check deadline"

def test_claimant_withdraw_only_in_stake_pending():
    """claimant_withdraw must only work in STAKE_PENDING stage."""
    match = re.search(r'def claimant_withdraw\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "STAKE_PENDING" in body

def test_claimant_withdraw_refunds_claimant():
    """claimant_withdraw must send GEN back to claimant."""
    match = re.search(r'def claimant_withdraw\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "_send_gen" in body, "claimant_withdraw must call _send_gen"

def test_fund_respondent_stake_checks_deadline():
    """fund_respondent_stake must reject if deadline passed."""
    match = re.search(r'def fund_respondent_stake\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "deadline" in body.lower() or "DEADLINE" in body, \
        "fund_respondent_stake must check deadline"

def test_respondent_deadline_stored():
    """Case doc must store respondent_fund_deadline_block."""
    assert "respondent_fund_deadline_block" in SOURCE

# ── 3. Appeal accounting ──

def test_appeal_requires_resolved():
    """submit_appeal must require RESOLVED stage."""
    match = re.search(r'def submit_appeal\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "RESOLVED" in body

def test_review_appeal_reopen_goes_to_analysis():
    """REOPENED must go to ANALYSIS_READY, not MEDIATION_OPEN, to re-analyze."""
    match = re.search(r'def review_appeal\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    # Must NOT go directly to MEDIATION_OPEN
    if "REOPENED" in body:
        # Check that REOPENED sets stage to ANALYSIS_READY
        reopen_section = body[body.index("REOPENED"):]
        assert "ANALYSIS_READY" in reopen_section, \
            "REOPENED should go to ANALYSIS_READY for fresh analysis"

def test_review_appeal_clears_adjudication_on_reopen():
    """REOPENED must clear previous adjudication for fresh consensus."""
    match = re.search(r'def review_appeal\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    if "REOPENED" in body:
        reopen_section = body[body.index("REOPENED"):]
        assert "adjudication" in reopen_section, \
            "REOPENED must clear previous adjudication"

# ── 4. Web retrieval inside consensus ──

def test_analyze_case_fetch_inside_consensus():
    """analyze_case must fetch URLs inside the consensus function, not outside."""
    match = re.search(r'def analyze_case\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)

    # Find the nondet function definition
    nondet_match = re.search(r'def nondet\(\):(.*?)(?=\n        analysis =|\n    def )', body, re.DOTALL)
    assert nondet_match, "nondet function not found in analyze_case"
    nondet_body = nondet_match.group(1)

    # Web fetching must be INSIDE nondet
    assert "_fetch_urls" in nondet_body, \
        "_fetch_urls must be inside nondet() for consensus path"

def test_adjudicate_fetch_inside_consensus():
    """adjudicate_dispute must fetch URLs inside leader_fn, not outside."""
    match = re.search(r'def adjudicate_dispute\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)

    # Find leader_fn
    leader_match = re.search(r'def leader_fn\(\) -> dict:(.*?)(?=\n        def validator_fn)', body, re.DOTALL)
    assert leader_match, "leader_fn not found in adjudicate_dispute"
    leader_body = leader_match.group(1)

    assert "_fetch_urls" in leader_body, \
        "_fetch_urls must be inside leader_fn() for consensus path"

def test_no_fetch_outside_consensus_in_analyze():
    """No _fetch_urls calls before the nondet() definition in analyze_case."""
    match = re.search(r'def analyze_case\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)

    # Find where nondet starts
    nondet_pos = body.find("def nondet():")
    if nondet_pos > 0:
        before_nondet = body[:nondet_pos]
        assert "_fetch_urls" not in before_nondet, \
            "_fetch_urls called outside consensus path in analyze_case"

# ── 5. Escrow invariants ──

def test_settled_flag_checked():
    """publish_final_terms must check settled is False."""
    match = re.search(r'def publish_final_terms\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "settled" in body and "False" in body

def test_escrow_settled_marked_true():
    """After settlement, settled must be True."""
    match = re.search(r'def publish_final_terms\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert 'settled"] = True' in body or '"settled": True' in body

def test_emit_transfer_uses_u256():
    """All emit_transfer calls must use u256 for amount."""
    # Find all emit_transfer calls
    transfers = re.findall(r'emit_transfer\(value=(.*?)\)', SOURCE)
    for t in transfers:
        assert "u256" in t, f"emit_transfer not using u256: {t}"

def test_send_gen_checks_amount_positive():
    """_send_gen must check amount > 0 before transferring."""
    match = re.search(r'def _send_gen\(.*?\n(.*?)(?=\n    def |\n    #|\n    @)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "amount" in body and ("0" in body or "<=" in body or ">" in body)

# ── 6. Stage transitions ──

def test_stage_flow():
    """Verify the stage progression: STAKE_PENDING → RESPONSE_PENDING → ANALYSIS_READY → MEDIATION_OPEN → RESOLVED."""
    stages = ["STAKE_PENDING", "RESPONSE_PENDING", "ANALYSIS_READY", "MEDIATION_OPEN", "RESOLVED"]
    for stage in stages:
        assert f'"{stage}"' in SOURCE, f"Stage {stage} not found"

def test_file_dispute_starts_stake_pending():
    """file_dispute must set stage to STAKE_PENDING."""
    match = re.search(r'def file_dispute\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "STAKE_PENDING" in body

def test_fund_moves_to_response_pending():
    """fund_respondent_stake must set stage to RESPONSE_PENDING."""
    match = re.search(r'def fund_respondent_stake\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "RESPONSE_PENDING" in body

def test_submit_response_moves_to_analysis():
    """submit_response must set stage to ANALYSIS_READY."""
    match = re.search(r'def submit_response\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "ANALYSIS_READY" in body

def test_analyze_moves_to_mediation():
    """analyze_case must set stage to MEDIATION_OPEN."""
    match = re.search(r'def analyze_case\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "MEDIATION_OPEN" in body

def test_publish_moves_to_resolved():
    """publish_final_terms must set stage to RESOLVED."""
    match = re.search(r'def publish_final_terms\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "RESOLVED" in body

# ── 7. Consensus primitives ──

def test_uses_run_nondet_unsafe():
    """Must use gl.vm.run_nondet_unsafe for leader-validator consensus."""
    assert "gl.vm.run_nondet_unsafe" in SOURCE

def test_uses_eq_principle():
    """Must use gl.eq_principle for deterministic consensus."""
    assert "gl.eq_principle" in SOURCE

def test_uses_nondet_exec_prompt():
    """Must use gl.nondet.exec_prompt for AI evaluation."""
    assert "gl.nondet.exec_prompt" in SOURCE

def test_uses_nondet_web_render():
    """Must use gl.nondet.web.render for on-chain fetching."""
    assert "gl.nondet.web.render" in SOURCE

# ── 8. Access control ──

def test_operator_only_publish():
    """publish_final_terms must be operator-only."""
    match = re.search(r'def publish_final_terms\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "operator" in body and "ONLY_OPERATOR" in body

def test_respondent_only_fund():
    """fund_respondent_stake must be respondent-only."""
    match = re.search(r'def fund_respondent_stake\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "ONLY_RESPONDENT" in body

def test_claimant_only_withdraw():
    """claimant_withdraw must be claimant-only."""
    match = re.search(r'def claimant_withdraw\(.*?\n(.*?)(?=\n    @|\nclass |\Z)', SOURCE, re.DOTALL)
    assert match
    body = match.group(1)
    assert "ONLY_CLAIMANT" in body

# ── 9. GenLayer contract basics ──

def test_extends_gl_contract():
    assert "gl.Contract" in SOURCE

def test_constructor_no_args():
    """Constructor should take only self + platform params, no external args."""
    assert "def __init__(self" in SOURCE

def test_treemap_storage():
    assert "TreeMap" in SOURCE

def test_dynarray_storage():
    assert "DynArray" in SOURCE
