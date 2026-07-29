import type {
  AppealRecord,
  CaseRoles,
  DisputeRecord,
  MediationOptionKey,
  PlatformConfig,
} from "../domain/types";

export const mockPlatformConfig: PlatformConfig = {
  platformName: "AccordMesh",
  rulesUri: "ipfs://community-rules",
  operator: "0xA11c...0Per",
};

function makeRoles(claimant: string, respondent: string): CaseRoles {
  return {
    claimant: [claimant],
    respondent: [respondent],
    counsel: ["0xC0unsel...77A1"],
    reviewer: ["0xRev1...4A21"],
    regulator: ["0xRegu...1188"],
  };
}

function makeAppeal(overrides?: Partial<AppealRecord>): AppealRecord {
  return {
    submittedBy: "0x3d1d...a1b9",
    requestedAction: "Reopen mediation and narrow the remaining handoff scope.",
    rationale: "The final terms did not account for a later acceptance message and a corrected delivery archive.",
    evidenceUrls: ["https://ipfs.io/ipfs/bafybeiappeal1"],
    status: "PENDING_REVIEW",
    reviewMemo: "",
    reviewedBy: "",
    ...overrides,
  };
}

export const mockDisputes: DisputeRecord[] = [
  {
    id: "12",
    caseType: "Freelance delivery",
    title: "Design milestone withheld after revision loop",
    stage: "MEDIATION_OPEN",
    claimant: "0x3D1d...A1b9",
    respondent: "0x8Ea0...4f20",
    claimantStatement:
      "Claimant says the third milestone was completed and accepted in Slack, but payment was withheld after unbounded revision requests.",
    respondentStatement:
      "Respondent says the delivered work did not satisfy the agreed conversion goals and that handoff assets were incomplete.",
    claimantEvidenceUrls: [
      "https://ipfs.io/ipfs/bafybeidesignscope",
      "https://drive.google.com/design-handoff",
    ],
    respondentEvidenceUrls: [
      "https://drive.google.com/revision-notes",
      "https://ipfs.io/ipfs/bafybeiqa-commentary",
    ],
    issueMap:
      "1. Whether milestone acceptance occurred. 2. Whether revision scope exceeded contract language. 3. Whether delivery artifacts were materially incomplete.",
    credibilityNotes:
      "Both parties reference off-platform communications. The strongest missing evidence is the signed scope version and delivery archive hash.",
    settlementOptions: [
      "Release 65% of the milestone and require final asset delivery within 48 hours.",
      "Neutral third-party design QA followed by split outcome payment.",
      "Refund 30% and terminate the remaining engagement without further revisions.",
    ],
    draftResolution:
      "A partial payment path appears proportionate if acceptance evidence is corroborated by message timestamps and asset transfer logs.",
    mediationPositions: {
      "0x3d1d...a1b9": {
        option: "A",
        rationale: "Claimant is willing to accept partial release if the remaining handoff is tightly scoped.",
      },
    },
    finalTerms: "",
    roles: makeRoles("0x3D1d...A1b9", "0x8Ea0...4f20"),
    appeals: [],
  },
  {
    id: "13",
    caseType: "Marketplace refund",
    title: "Collector item authenticity dispute",
    stage: "RESOLVED",
    claimant: "0xAa21...9d0C",
    respondent: "0x0b95...1F33",
    claimantStatement:
      "Claimant alleges the item description implied original manufacturer certification that was not present at delivery.",
    respondentStatement:
      "Respondent says the listing included close-up photos and that no certification was ever promised in writing.",
    claimantEvidenceUrls: [
      "https://drive.google.com/order-13",
      "https://ipfs.io/ipfs/bafybeicertificate-missing",
    ],
    respondentEvidenceUrls: ["https://ipfs.io/ipfs/bafybeilisting-archive"],
    issueMap:
      "1. Whether certification was expressly promised. 2. Whether the listing language created a reasonable authenticity expectation. 3. Whether return handling complied with marketplace policy.",
    credibilityNotes:
      "The file is strongest on listing screenshots and weakest on the post-delivery support timeline.",
    settlementOptions: [
      "Return-and-refund with tracked logistics.",
      "Partial refund for diminished collectible value.",
      "Independent authenticity review at shared cost.",
    ],
    draftResolution:
      "A return-based remedy appears strongest if the listing language implied certification beyond the photographs themselves.",
    mediationPositions: {},
    finalTerms:
      "Respondent shall accept return shipment within five business days and release a full refund upon confirmed receipt.",
    roles: makeRoles("0xAa21...9d0C", "0x0b95...1F33"),
    appeals: [
      makeAppeal({
        submittedBy: "0xAa21...9d0C",
        requestedAction: "Modify terms to include shipping reimbursement.",
        rationale: "The resolved terms omitted return-shipping costs even though the listing defect triggered the return.",
      }),
    ],
  },
];

export function cloneMockDisputes() {
  return structuredClone(mockDisputes);
}

export function upsertMediationPosition(
  dispute: DisputeRecord,
  actor: string,
  option: MediationOptionKey,
  rationale: string,
) {
  dispute.mediationPositions[actor] = {
    option,
    rationale,
  };
}

export const MOCK_STORAGE_KEY = "accordmesh.mock.disputes";
