import type { DisputeRecord, MediationOptionKey, PlatformConfig } from "../domain/types";

export const mockPlatformConfig: PlatformConfig = {
  platformName: "AccordMesh",
  rulesUri: "ipfs://community-rules",
  operator: "0xA11c...0Per",
};

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
      "https://notion.so/project-scope-v3",
      "https://drive.google.com/design-handoff",
    ],
    respondentEvidenceUrls: [
      "https://docs.example/revision-notes",
      "https://figma.com/file/qa-commentary",
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
  },
  {
    id: "13",
    caseType: "Marketplace refund",
    title: "Collector item authenticity dispute",
    stage: "RESPONSE_PENDING",
    claimant: "0xAa21...9d0C",
    respondent: "0x0b95...1F33",
    claimantStatement:
      "Claimant alleges the item description implied original manufacturer certification that was not present at delivery.",
    respondentStatement: "",
    claimantEvidenceUrls: [
      "https://marketplace.example/order/13",
      "https://ipfs.io/ipfs/bafybeicertificate-missing",
    ],
    respondentEvidenceUrls: [],
    issueMap: "",
    credibilityNotes: "",
    settlementOptions: [],
    draftResolution: "",
    mediationPositions: {},
    finalTerms: "",
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
