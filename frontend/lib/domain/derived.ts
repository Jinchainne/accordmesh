import type { DisputeRecord } from "./types";

export function getCaseReadiness(dispute: DisputeRecord) {
  let score = 20;

  if (dispute.escrow.claimantDeposited) score += 10;
  if (dispute.escrow.respondentDeposited) score += 10;
  if (dispute.claimantStatement.trim()) score += 15;
  if (dispute.claimantEvidenceUrls.length) score += 15;
  if (dispute.respondentStatement.trim()) score += 15;
  if (dispute.respondentEvidenceUrls.length) score += 10;
  if (dispute.issueMap.trim()) score += 10;
  if (dispute.credibilityNotes.trim()) score += 5;
  if (dispute.settlementOptions.length) score += 5;
  if (Object.keys(dispute.mediationPositions).length) score += 5;

  return Math.min(score, 100);
}

export function getStageLabel(stage: DisputeRecord["stage"]) {
  switch (stage) {
    case "STAKE_PENDING":
      return "Awaiting respondent stake";
    case "RESPONSE_PENDING":
      return "Response pending";
    case "ANALYSIS_READY":
      return "Ready for analysis";
    case "MEDIATION_OPEN":
      return "Mediation open";
    case "RESOLVED":
      return "Resolved";
    default:
      return stage;
  }
}
