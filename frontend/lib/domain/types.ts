export type DisputeStage =
  | "STAKE_PENDING"
  | "RESPONSE_PENDING"
  | "ANALYSIS_READY"
  | "MEDIATION_OPEN"
  | "RESOLVED";

export type MediationOptionKey = "A" | "B" | "C" | "REJECT";
export type RoleName = "claimant" | "respondent" | "counsel" | "reviewer" | "regulator";
export type AppealStatus = "PENDING_REVIEW" | "UPHELD" | "REOPENED" | "MODIFIED_TERMS";
export type PrevailingParty = "CLAIMANT" | "RESPONDENT";

export type MediationPosition = {
  option: MediationOptionKey;
  rationale: string;
};

export type AppealRecord = {
  submittedBy: string;
  requestedAction: string;
  rationale: string;
  evidenceUrls: string[];
  status: AppealStatus;
  reviewMemo: string;
  reviewedBy: string;
};

export type CaseRoles = Record<RoleName, string[]>;

export type EscrowBreakdown = {
  requiredStakeWei: string;
  claimantStakeWei: string;
  respondentStakeWei: string;
  claimantDeposited: boolean;
  respondentDeposited: boolean;
  totalEscrowWei: string;
  winner: PrevailingParty | "";
  loserPenaltyBps: number;
  operatorFeeBps: number;
  winnerPayoutWei: string;
  loserRefundWei: string;
  operatorFeeWei: string;
  settled: boolean;
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
  adjudication?: {
    verdict: string;
    confidence: string;
    score: number;
    reason: string;
    evidence_used: string[];
    fetched_sources_summary: string[];
  };
  finalTerms: string;
  roles: CaseRoles;
  appeals: AppealRecord[];
  escrow: EscrowBreakdown;
};

export type NewDisputeInput = {
  caseType: string;
  title: string;
  respondent: string;
  claimantStatement: string;
  evidenceUrls: string;
  stakeAmountGen: string;
};

export type ResponseInput = {
  caseId: string;
  respondentStatement: string;
  evidenceUrls: string;
};

export type DepositInput = {
  caseId: string;
};

export type MediationInput = {
  caseId: string;
  option: MediationOptionKey;
  rationale: string;
};

export type FinalTermsInput = {
  caseId: string;
  finalTerms: string;
  prevailingParty: PrevailingParty;
  loserPenaltyBps: number;
  operatorFeeBps: number;
};

export type AssignRoleInput = {
  caseId: string;
  role: Exclude<RoleName, "claimant" | "respondent">;
  assignee: string;
};

export type AppealInput = {
  caseId: string;
  requestedAction: string;
  rationale: string;
  evidenceUrls: string;
};

export type AppealReviewInput = {
  caseId: string;
  appealIndex: number;
  disposition: Exclude<AppealStatus, "PENDING_REVIEW">;
  reviewMemo: string;
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

export type RegulatoryPacket = {
  coverTitle: string;
  executiveSummary: string;
  jurisdictionNote: string;
  proceduralHistory: string[];
  evidenceIndex: string[];
  findings: string[];
  resolutionBasis: string[];
  postResolutionActions: string[];
};
