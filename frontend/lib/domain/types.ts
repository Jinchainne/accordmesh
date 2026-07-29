export type DisputeStage =
  | "RESPONSE_PENDING"
  | "ANALYSIS_READY"
  | "MEDIATION_OPEN"
  | "RESOLVED";

export type MediationOptionKey = "A" | "B" | "C" | "REJECT";

export type MediationPosition = {
  option: MediationOptionKey;
  rationale: string;
};

export type DisputeRecord = {
  id: string;
  caseType: string;
  title: string;
  stage: DisputeStage;
  claimant: string;
  respondent: string;
  claimantStatement: string;
  respondentStatement: string;
  claimantEvidenceUrls: string[];
  respondentEvidenceUrls: string[];
  issueMap: string;
  credibilityNotes: string;
  settlementOptions: string[];
  draftResolution: string;
  mediationPositions: Record<string, MediationPosition>;
  finalTerms: string;
};

export type NewDisputeInput = {
  caseType: string;
  title: string;
  respondent: string;
  claimantStatement: string;
  evidenceUrls: string;
};

export type ResponseInput = {
  caseId: string;
  respondentStatement: string;
  evidenceUrls: string;
};

export type MediationInput = {
  caseId: string;
  option: MediationOptionKey;
  rationale: string;
};

export type FinalTermsInput = {
  caseId: string;
  finalTerms: string;
};

export type PlatformConfig = {
  platformName: string;
  rulesUri: string;
  operator: string;
};

export type TransactionPhase = "idle" | "pending" | "success" | "error";

export type TransactionState = {
  phase: TransactionPhase;
  label: string;
  hash?: string;
  detail?: string;
};

