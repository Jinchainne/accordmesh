import {
  cloneMockDisputes,
  mockPlatformConfig,
  MOCK_STORAGE_KEY,
  upsertMediationPosition,
} from "../mock/disputes";
import { isMockMode } from "../genlayer/config";
import { AccordMeshContractClient, ExecutionResult } from "../contracts/accordMesh";
import type {
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

export async function createDispute(input: NewDisputeInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const created = {
      id: String(Date.now()),
      caseType: input.caseType,
      title: input.title,
      stage: "RESPONSE_PENDING" as const,
      claimant: actor ?? "0xClaimant",
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
    const dispute = mockDisputes.find((item) => item.id === input.caseId);
    if (!dispute) {
      throw new Error("Case not found.");
    }

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
    const dispute = mockDisputes.find((item) => item.id === caseId);
    if (!dispute) {
      throw new Error("Case not found.");
    }

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
    const dispute = mockDisputes.find((item) => item.id === input.caseId);
    if (!dispute) {
      throw new Error("Case not found.");
    }

    upsertMediationPosition(dispute, actor ?? "0xActor", input.option, input.rationale);
    saveMockDisputesToStorage();
    return `mock-mediation-${Date.now()}`;
  }

  const result = await contractClient.recordMediation(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}

export async function publishFinalTerms(input: FinalTermsInput, actor?: string): Promise<string> {
  if (isMockMode) {
    const dispute = mockDisputes.find((item) => item.id === input.caseId);
    if (!dispute) {
      throw new Error("Case not found.");
    }

    dispute.finalTerms = input.finalTerms;
    dispute.stage = "RESOLVED";
    saveMockDisputesToStorage();
    return `mock-final-${Date.now()}`;
  }

  const result = await contractClient.publishFinalTerms(input, actor);
  assertSuccessfulExecution(result.executionResultName);
  return result.hash;
}
