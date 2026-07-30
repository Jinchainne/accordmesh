import {
  cloneMockDisputes,
  mockPlatformConfig,
  MOCK_STORAGE_KEY,
  upsertMediationPosition,
} from "../mock/disputes";
import { isMockMode } from "../genlayer/config";
import { AccordMeshContractClient, ExecutionResult } from "../contracts/accordMesh";
import type {
  AppealReviewInput,
  AppealInput,
  AssignRoleInput,
  DisputeRecord,
  FinalTermsInput,
  MediationInput,
  NewDisputeInput,
  PlatformConfig,
  ResponseInput,
} from "../domain/types";

const contractClient = new AccordMeshContractClient();
let mockDisputes = cloneMockDisputes();

function loadMockDisputesFromStorage() {
  if (typeof window === "undefined") {
    return;
  }

  const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as DisputeRecord[];
    if (Array.isArray(parsed)) {
      mockDisputes = parsed;
    }
  } catch {
    mockDisputes = cloneMockDisputes();
  }
}

function saveMockDisputesToStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockDisputes));
}

function assertSuccessfulExecution(executionResultName?: string) {
  if (
    executionResultName &&
    executionResultName !== ExecutionResult.FINISHED_WITH_RETURN
  ) {
    throw new Error(`Transaction executed with status ${executionResultName}.`);
  }
}

function requireMockCase(caseId: string) {
  const dispute = mockDisputes.find((item) => item.id === caseId);
  if (!dispute) {
    throw new Error("Case not found.");
  }

  return dispute;
}

export async function listDisputes(): Promise<DisputeRecord[]> {
  if (isMockMode) {
    loadMockDisputesFromStorage();
    return mockDisputes;
  }

  const ids = await contractClient.getCaseIds();
  const records = await Promise.all(ids.map((id) => contractClient.getCase(id)));
  return records.filter((record): record is DisputeRecord => record !== null);
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (isMockMode) {
    return mockPlatformConfig;
  }

  const platformConfig = await contractClient.getPlatformConfig();
  return (
    platformConfig ?? {
      platformName: "AccordMesh",
      rulesUri: "",
      operator: "",
    }
  );
}

export async function loadWorkspaceSnapshot(): Promise<{
  disputes: DisputeRecord[];
  platformConfig: PlatformConfig;
  warnings: string[];
}> {
  if (isMockMode) {
    loadMockDisputesFromStorage();
    return {
      disputes: mockDisputes,
      platformConfig: mockPlatformConfig,
      warnings: [],
    };
  }

  const [disputesResult, platformConfigResult] = await Promise.allSettled([
    listDisputes(),
    getPlatformConfig(),
  ]);

  const warnings: string[] = [];

  const disputes =
    disputesResult.status === "fulfilled"
      ? disputesResult.value
      : [];

  if (disputesResult.status === "rejected") {
    warnings.push(
      disputesResult.reason instanceof Error
        ? `Case board sync failed: ${disputesResult.reason.message}`
        : "Case board sync failed.",
    );
  }

  const platformConfig =
    platformConfigResult.status === "fulfilled"
      ? platformConfigResult.value
      : {
          platformName: "AccordMesh",
          rulesUri: "",
          operator: "",
        };

  if (platformConfigResult.status === "rejected") {
    warnings.push(
      platformConfigResult.reason instanceof Error
        ? `Platform config sync failed: ${platformConfigResult.reason.message}`
        : "Platform config sync failed.",
    );
  }

  return { disputes, platformConfig, warnings };
}

export async function createDispute(input: NewDisputeInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const claimant = actor ?? "0xClaimant";
    const created: DisputeRecord = {
      id: String(Date.now()),
      caseType: input.caseType,
      title: input.title,
      stage: "RESPONSE_PENDING",
      claimant,
      respondent: input.respondent,
      claimantStatement: input.claimantStatement,
      respondentStatement: "",
      claimantEvidenceUrls: input.evidenceUrls
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      respondentEvidenceUrls: [],
      issueMap: "",
      credibilityNotes: "",
      settlementOptions: [],
      draftResolution: "",
      mediationPositions: {},
      finalTerms: "",
      roles: {
        claimant: [claimant],
        respondent: [input.respondent],
        counsel: [],
        reviewer: [],
        regulator: [],
      },
      appeals: [],
    };
    mockDisputes.unshift(created);
    saveMockDisputesToStorage();
    return created.id;
  }

  const result = await contractClient.fileDispute(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function submitResponse(input: ResponseInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = requireMockCase(input.caseId);
    dispute.respondentStatement = input.respondentStatement;
    dispute.respondentEvidenceUrls = input.evidenceUrls
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    dispute.stage = "ANALYSIS_READY";
    saveMockDisputesToStorage();
    return `mock-response-${Date.now()}`;
  }

  const result = await contractClient.submitResponse(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function analyzeCase(caseId: string, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = requireMockCase(caseId);
    dispute.stage = "MEDIATION_OPEN";
    dispute.issueMap =
      "1. Identify the operative agreement. 2. Determine whether key deliverables were accepted. 3. Compare remedy sought against remaining obligations.";
    dispute.credibilityNotes =
      "The record is strongest where timestamps and artifact links align. The weakest points still depend on off-platform understandings.";
    dispute.settlementOptions = [
      "Option A: partial release tied to a clean final handoff within 72 hours.",
      "Option B: neutral quality review with split fees and binding acceptance criteria.",
      "Option C: unwind the relationship with a capped refund and mutual release.",
    ];
    dispute.draftResolution =
      "A mediation-first result appears proportional because both parties present some credible support and the missing facts can be narrowed through deliverable verification.";
    saveMockDisputesToStorage();
    return `mock-analysis-${Date.now()}`;
  }

  const result = await contractClient.analyzeCase(caseId, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function recordMediation(input: MediationInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = requireMockCase(input.caseId);
    upsertMediationPosition(dispute, actor ?? "0xActor", input.option, input.rationale);
    saveMockDisputesToStorage();
    return `mock-mediation-${Date.now()}`;
  }

  const result = await contractClient.recordMediation(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function assignRole(input: AssignRoleInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = requireMockCase(input.caseId);
    if (!dispute.roles[input.role].includes(input.assignee)) {
      dispute.roles[input.role].push(input.assignee);
    }
    saveMockDisputesToStorage();
    return `mock-role-${Date.now()}-${actor ?? "operator"}`;
  }

  const result = await contractClient.assignRole(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function submitAppeal(input: AppealInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = requireMockCase(input.caseId);
    dispute.appeals.unshift({
      submittedBy: actor ?? "0xActor",
      requestedAction: input.requestedAction,
      rationale: input.rationale,
      evidenceUrls: input.evidenceUrls
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: "PENDING_REVIEW",
      reviewMemo: "",
      reviewedBy: "",
    });
    saveMockDisputesToStorage();
    return `mock-appeal-${Date.now()}`;
  }

  const result = await contractClient.submitAppeal(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function reviewAppeal(input: AppealReviewInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = requireMockCase(input.caseId);
    const target = dispute.appeals[input.appealIndex];
    if (!target) {
      throw new Error("Appeal not found.");
    }

    target.status = input.disposition;
    target.reviewMemo = input.reviewMemo;
    target.reviewedBy = actor ?? "0xReviewer";

    if (input.disposition === "REOPENED") {
      dispute.stage = "MEDIATION_OPEN";
    }

    saveMockDisputesToStorage();
    return `mock-appeal-review-${Date.now()}`;
  }

  const result = await contractClient.reviewAppeal(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function publishFinalTerms(input: FinalTermsInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = requireMockCase(input.caseId);
    dispute.finalTerms = input.finalTerms;
    dispute.stage = "RESOLVED";
    saveMockDisputesToStorage();
    return `mock-final-${Date.now()}`;
  }

  const result = await contractClient.publishFinalTerms(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}
