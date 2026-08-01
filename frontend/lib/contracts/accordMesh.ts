import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Hash } from "genlayer-js/types";
import { parseEther } from "viem";
import { appConfig } from "../genlayer/config";
import { createReadClient, createWriteClient, withTimeout } from "../genlayer/client";
import { getActiveBrowserProvider } from "../genlayer/wallet";
import type {
  AppealReviewInput,
  AppealInput,
  AssignRoleInput,
  DepositInput,
  DisputeRecord,
  FinalTermsInput,
  MediationInput,
  NewDisputeInput,
  PlatformConfig,
  ResponseInput,
} from "../domain/types";

type ContractActionResult = {
  hash: string;
  executionResultName?: string;
  statusName?: string;
};

function requireContractAddress() {
  if (!appConfig.contractAddress) {
    throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS.");
  }

  return appConfig.contractAddress as `0x${string}`;
}

function requireWalletAddress(address?: string) {
  if (!address) {
    throw new Error("Connect a wallet before sending transactions.");
  }

  return address as `0x${string}`;
}

function requireProvider() {
  const provider = getActiveBrowserProvider();
  if (!provider) {
    throw new Error("No browser wallet detected. Install MetaMask, OKX Wallet, or another injected EVM wallet.");
  }

  return provider;
}

function normalizeRecord(record: Record<string, unknown>): DisputeRecord {
  const claimantEvidenceUrls = Array.isArray(record.claimant_evidence_urls)
    ? record.claimant_evidence_urls.map(String)
    : [];
  const respondentEvidenceUrls = Array.isArray(record.respondent_evidence_urls)
    ? record.respondent_evidence_urls.map(String)
    : [];
  const mediationPositions = (record.mediation_positions ?? {}) as DisputeRecord["mediationPositions"];
  const roles = (record.roles ?? {
    claimant: [],
    respondent: [],
    counsel: [],
    reviewer: [],
    regulator: [],
  }) as DisputeRecord["roles"];
  const appeals = Array.isArray(record.appeals)
    ? record.appeals.map((appeal) => {
        const parsed = appeal as Record<string, unknown>;
        return {
          submittedBy: String(parsed.submitted_by ?? ""),
          requestedAction: String(parsed.requested_action ?? ""),
          rationale: String(parsed.rationale ?? ""),
          evidenceUrls: Array.isArray(parsed.evidence_urls) ? parsed.evidence_urls.map(String) : [],
          status: String(parsed.status ?? "PENDING_REVIEW") as DisputeRecord["appeals"][number]["status"],
          reviewMemo: String(parsed.review_memo ?? ""),
          reviewedBy: String(parsed.reviewed_by ?? ""),
        };
      })
    : [];
  const escrowRecord =
    record.escrow && typeof record.escrow === "object" && !Array.isArray(record.escrow)
      ? (record.escrow as Record<string, unknown>)
      : {};

  return {
    id: String(record.id ?? ""),
    caseType: String(record.case_type ?? ""),
    title: String(record.title ?? ""),
    stage: String(record.stage ?? "RESPONSE_PENDING") as DisputeRecord["stage"],
    claimant: String(record.claimant ?? ""),
    respondent: String(record.respondent ?? ""),
    claimantStatement: String(record.claimant_statement ?? ""),
    respondentStatement: String(record.respondent_statement ?? ""),
    claimantEvidenceUrls,
    respondentEvidenceUrls,
    issueMap: String(record.issue_map ?? ""),
    credibilityNotes: String(record.credibility_notes ?? ""),
    settlementOptions: [
      String(record.settlement_option_a ?? ""),
      String(record.settlement_option_b ?? ""),
      String(record.settlement_option_c ?? ""),
    ].filter(Boolean),
    draftResolution: String(record.draft_resolution ?? ""),
    mediationPositions,
    adjudication: record.adjudication ? {
      verdict: String((record.adjudication as Record<string, unknown>).verdict ?? ""),
      confidence: String((record.adjudication as Record<string, unknown>).confidence ?? ""),
      score: Number((record.adjudication as Record<string, unknown>).score ?? 0),
      reason: String((record.adjudication as Record<string, unknown>).reason ?? ""),
      evidence_used: Array.isArray((record.adjudication as Record<string, unknown>).evidence_used) ? ((record.adjudication as Record<string, unknown>).evidence_used as unknown[]).map(String) : [],
      fetched_sources_summary: Array.isArray((record.adjudication as Record<string, unknown>).fetched_sources_summary) ? ((record.adjudication as Record<string, unknown>).fetched_sources_summary as unknown[]).map(String) : [],
    } : undefined,
    finalTerms: String(record.final_terms ?? ""),
    roles,
    appeals,
    escrow: {
      requiredStakeWei: String(escrowRecord.required_stake_wei ?? "0"),
      claimantStakeWei: String(escrowRecord.claimant_stake_wei ?? "0"),
      respondentStakeWei: String(escrowRecord.respondent_stake_wei ?? "0"),
      claimantDeposited: Boolean(escrowRecord.claimant_deposited),
      respondentDeposited: Boolean(escrowRecord.respondent_deposited),
      totalEscrowWei: String(escrowRecord.total_escrow_wei ?? "0"),
      winner: String(escrowRecord.winner ?? "") as DisputeRecord["escrow"]["winner"],
      loserPenaltyBps: Number(escrowRecord.loser_penalty_bps ?? 0),
      operatorFeeBps: Number(escrowRecord.operator_fee_bps ?? 0),
      winnerPayoutWei: String(escrowRecord.winner_payout_wei ?? "0"),
      loserRefundWei: String(escrowRecord.loser_refund_wei ?? "0"),
      operatorFeeWei: String(escrowRecord.operator_fee_wei ?? "0"),
      settled: Boolean(escrowRecord.settled),
    },
  };
}

async function waitForReceipt(hash: string) {
  const client = createReadClient();
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as Hash,
    status: TransactionStatus.ACCEPTED,
  });

  return {
    hash,
    executionResultName: receipt.txExecutionResultName,
    statusName: receipt.statusName,
  };
}

async function getWriteClient(address?: string) {
  const provider = requireProvider();
  const writeClient = createWriteClient(requireWalletAddress(address), provider);
  await writeClient.connect(appConfig.networkName as never);
  return writeClient;
}

export class AccordMeshContractClient {
  async getPlatformConfig(): Promise<PlatformConfig | null> {
    if (!appConfig.contractAddress) {
      return null;
    }

    const result = await withTimeout(createReadClient().readContract({
      address: requireContractAddress(),
      functionName: "get_platform_config",
      args: [],
    }));

    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return null;
    }

    const config = result as Record<string, unknown>;
    return {
      platformName: String(config.platform_name ?? ""),
      rulesUri: String(config.rules_uri ?? ""),
      operator: String(config.operator ?? ""),
    };
  }

  async getCaseIds(): Promise<string[]> {
    if (!appConfig.contractAddress) {
      return [];
    }

    const result = await withTimeout(createReadClient().readContract({
      address: requireContractAddress(),
      functionName: "get_case_ids",
      args: [],
    }));

    return Array.isArray(result) ? result.map(String) : [];
  }

  async getCase(caseId: string): Promise<DisputeRecord | null> {
    if (!appConfig.contractAddress) {
      return null;
    }

    const rawDocument = await withTimeout(createReadClient().readContract({
      address: requireContractAddress(),
      functionName: "get_case_document",
      args: [BigInt(caseId)],
    }));

    if (typeof rawDocument !== "string") {
      return null;
    }

    return normalizeRecord(JSON.parse(rawDocument) as Record<string, unknown>);
  }

  async fileDispute(input: NewDisputeInput, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const stakeValue = parseEther(input.stakeAmountGen || "0");
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "file_dispute",
      args: [
        input.caseType,
        input.title,
        input.respondent,
        input.claimantStatement,
        input.evidenceUrls,
        stakeValue,
      ],
      value: stakeValue,
    });
    return waitForReceipt(String(hash));
  }

  async fundRespondentStake(input: DepositInput, address?: string): Promise<ContractActionResult> {
    const caseRecord = await this.getCase(input.caseId);
    if (!caseRecord) {
      throw new Error("Case not found.");
    }

    const writeClient = await getWriteClient(address);
    const requiredStake = BigInt(caseRecord.escrow.requiredStakeWei || "0");
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "fund_respondent_stake",
      args: [BigInt(input.caseId)],
      value: requiredStake,
    });
    return waitForReceipt(String(hash));
  }

  async submitResponse(input: ResponseInput, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "submit_response",
      args: [BigInt(input.caseId), input.respondentStatement, input.evidenceUrls],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }

  async analyzeCase(caseId: string, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "analyze_case",
      args: [BigInt(caseId)],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }

  async adjudicateDispute(caseId: string, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "adjudicate_dispute",
      args: [BigInt(caseId)],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }

  async recordMediation(input: MediationInput, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "record_mediation_position",
      args: [BigInt(input.caseId), input.option, input.rationale],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }

  async assignRole(input: AssignRoleInput, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "assign_case_role",
      args: [BigInt(input.caseId), input.role, input.assignee],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }

  async submitAppeal(input: AppealInput, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "submit_appeal",
      args: [BigInt(input.caseId), input.requestedAction, input.rationale, input.evidenceUrls],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }

  async reviewAppeal(input: AppealReviewInput, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "review_appeal",
      args: [BigInt(input.caseId), BigInt(input.appealIndex), input.disposition, input.reviewMemo],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }

  async publishFinalTerms(input: FinalTermsInput, address?: string): Promise<ContractActionResult> {
    const writeClient = await getWriteClient(address);
    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "publish_final_terms",
      args: [
        BigInt(input.caseId),
        input.finalTerms,
        input.prevailingParty,
        BigInt(input.loserPenaltyBps),
        BigInt(input.operatorFeeBps),
      ],
      value: BigInt(0),
    });
    return waitForReceipt(String(hash));
  }
}

export { ExecutionResult };
