import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Hash } from "genlayer-js/types";
import { appConfig } from "../genlayer/config";
import { createReadClient, createWriteClient } from "../genlayer/client";
import { getBrowserProvider } from "../genlayer/wallet";
import type {
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
  const provider = getBrowserProvider();
  if (!provider) {
    throw new Error("No browser wallet detected. Install MetaMask or another injected wallet.");
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
    finalTerms: String(record.final_terms ?? ""),
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

export class AccordMeshContractClient {
  async getPlatformConfig(): Promise<PlatformConfig | null> {
    if (!appConfig.contractAddress) {
      return null;
    }

    const result = await createReadClient().readContract({
      address: requireContractAddress(),
      functionName: "get_platform_config",
      args: [],
    });

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

    const result = await createReadClient().readContract({
      address: requireContractAddress(),
      functionName: "get_case_ids",
      args: [],
    });

    return Array.isArray(result) ? result.map(String) : [];
  }

  async getCase(caseId: string): Promise<DisputeRecord | null> {
    if (!appConfig.contractAddress) {
      return null;
    }

    const rawDocument = await createReadClient().readContract({
      address: requireContractAddress(),
      functionName: "get_case_document",
      args: [BigInt(caseId)],
    });

    if (typeof rawDocument !== "string") {
      return null;
    }

    return normalizeRecord(JSON.parse(rawDocument) as Record<string, unknown>);
  }

  async fileDispute(input: NewDisputeInput, address?: string): Promise<ContractActionResult> {
    const provider = requireProvider();
    const writeClient = createWriteClient(requireWalletAddress(address), provider);
    await writeClient.connect(appConfig.networkName as never);

    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "file_dispute",
      args: [
        input.caseType,
        input.title,
        input.respondent,
        input.claimantStatement,
        input.evidenceUrls,
      ],
      value: BigInt(0),
    });

    return waitForReceipt(String(hash));
  }

  async submitResponse(input: ResponseInput, address?: string): Promise<ContractActionResult> {
    const provider = requireProvider();
    const writeClient = createWriteClient(requireWalletAddress(address), provider);
    await writeClient.connect(appConfig.networkName as never);

    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "submit_response",
      args: [BigInt(input.caseId), input.respondentStatement, input.evidenceUrls],
      value: BigInt(0),
    });

    return waitForReceipt(String(hash));
  }

  async analyzeCase(caseId: string, address?: string): Promise<ContractActionResult> {
    const provider = requireProvider();
    const writeClient = createWriteClient(requireWalletAddress(address), provider);
    await writeClient.connect(appConfig.networkName as never);

    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "analyze_case",
      args: [BigInt(caseId)],
      value: BigInt(0),
    });

    return waitForReceipt(String(hash));
  }

  async recordMediation(input: MediationInput, address?: string): Promise<ContractActionResult> {
    const provider = requireProvider();
    const writeClient = createWriteClient(requireWalletAddress(address), provider);
    await writeClient.connect(appConfig.networkName as never);

    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "record_mediation_position",
      args: [BigInt(input.caseId), input.option, input.rationale],
      value: BigInt(0),
    });

    return waitForReceipt(String(hash));
  }

  async publishFinalTerms(input: FinalTermsInput, address?: string): Promise<ContractActionResult> {
    const provider = requireProvider();
    const writeClient = createWriteClient(requireWalletAddress(address), provider);
    await writeClient.connect(appConfig.networkName as never);

    const hash = await writeClient.writeContract({
      address: requireContractAddress(),
      functionName: "publish_final_terms",
      args: [BigInt(input.caseId), input.finalTerms],
      value: BigInt(0),
    });

    return waitForReceipt(String(hash));
  }
}

export { ExecutionResult };
