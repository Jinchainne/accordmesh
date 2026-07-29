export type PolicyPack = {
  id: string;
  label: string;
  summary: string;
  intakePrompts: string[];
  requiredEvidence: string[];
  likelyRemedies: string[];
};

export const policyPacks: PolicyPack[] = [
  {
    id: "Freelance delivery",
    label: "Freelance Delivery",
    summary:
      "Handles milestone acceptance, revision loops, asset handoff, completion disputes, and payout timing.",
    intakePrompts: [
      "What exact scope or milestone was due?",
      "How was acceptance supposed to happen?",
      "Which files, assets, or repositories prove delivery?",
      "What remedy are you asking for: release, refund, completion, or termination?",
    ],
    requiredEvidence: [
      "Proposal or scope of work",
      "Delivery artifact or repository link",
      "Message timestamps about review or acceptance",
      "Invoice, payout request, or escrow reference",
    ],
    likelyRemedies: [
      "Partial release against final handoff",
      "Rework under narrow acceptance criteria",
      "Refund plus close-out obligations",
    ],
  },
  {
    id: "Marketplace refund",
    label: "Marketplace Refund",
    summary:
      "Designed for item mismatch, authenticity, condition, shipment, and refund-eligibility disputes.",
    intakePrompts: [
      "What did the listing promise?",
      "What mismatch or authenticity issue is alleged?",
      "What happened at delivery and after delivery?",
      "Was there a return or support process?",
    ],
    requiredEvidence: [
      "Listing snapshot",
      "Order receipt or payment proof",
      "Delivery photos or inspection video",
      "Support correspondence",
    ],
    likelyRemedies: [
      "Full refund on return",
      "Partial refund for diminished value",
      "Independent authenticity review",
    ],
  },
  {
    id: "Loan repayment",
    label: "Loan Repayment",
    summary:
      "Supports informal or platform-based loans with disputed repayment timing, extensions, or outstanding balances.",
    intakePrompts: [
      "What amount was lent, and when?",
      "What repayment schedule was promised?",
      "Were extensions or revised promises made later?",
      "How much remains outstanding?",
    ],
    requiredEvidence: [
      "Transfer proof",
      "Original repayment promise",
      "Messages discussing extensions or partial payments",
      "Balance calculation",
    ],
    likelyRemedies: [
      "Revised payment plan",
      "Immediate partial settlement",
      "Confirmed balance with deadline",
    ],
  },
  {
    id: "B2B service scope",
    label: "B2B Service Scope",
    summary:
      "Focused on statements of work, change requests, dependency delays, acceptance standards, and fee adjustment.",
    intakePrompts: [
      "What baseline statement of work governed the engagement?",
      "Which changes were requested after kickoff?",
      "Which dependencies were delayed by either side?",
      "What fees or deliverables remain disputed?",
    ],
    requiredEvidence: [
      "Statement of work",
      "Change request log",
      "Project timeline or board",
      "Invoice and payment history",
    ],
    likelyRemedies: [
      "Scope reset with revised fee",
      "Split liability for timeline slippage",
      "Termination with close-out duties",
    ],
  },
];

export function getPolicyPack(caseType: string) {
  return policyPacks.find((pack) => pack.id === caseType) ?? policyPacks[0];
}

