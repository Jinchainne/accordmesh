"use client";

import { formatEther } from "viem";
import { useState, useTransition } from "react";
import { getCaseReadiness, getStageLabel } from "../lib/domain/derived";
import { getPolicyPack } from "../lib/domain/policy-packs";
import type {
  AppealReviewInput,
  AppealInput,
  AssignRoleInput,
  DisputeRecord,
  FinalTermsInput,
  MediationInput,
  PrevailingParty,
  RegulatoryPacket,
  ResponseInput,
  RoleName,
} from "../lib/domain/types";
import { EvidenceUploader } from "./evidence-uploader";

type CaseDetailProps = {
  dispute: DisputeRecord | null;
  operator: string;
  connectedAddress: string;
  busy: boolean;
  onFundRespondentStake(caseId: string): Promise<void>;
  onRespond(input: ResponseInput): Promise<void>;
  onAnalyze(caseId: string): Promise<void>;
  onAdjudicate(caseId: string): Promise<void>;
  onMediation(input: MediationInput): Promise<void>;
  onFinalize(input: FinalTermsInput): Promise<void>;
  onAssignRole(input: AssignRoleInput): Promise<void>;
  onSubmitAppeal(input: AppealInput): Promise<void>;
  onReviewAppeal(input: AppealReviewInput): Promise<void>;
};

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function formatGen(wei: string) {
  try {
    return `${Number(formatEther(BigInt(wei || "0"))).toLocaleString("en-US", {
      maximumFractionDigits: 4,
    })} GEN`;
  } catch {
    return "0 GEN";
  }
}

function buildRegulatoryPacket(dispute: DisputeRecord): RegulatoryPacket {
  return {
    coverTitle: `Regulatory Submission Packet for Case ${dispute.id}`,
    executiveSummary:
      dispute.finalTerms ||
      dispute.draftResolution ||
      "This dispute file contains a structured record of the parties, evidence, analysis outputs, and proposed resolution path.",
    jurisdictionNote:
      "Prepared as a neutral digital casework dossier for downstream review by a regulator, marketplace trust team, ombuds office, or oversight body.",
    proceduralHistory: [
      `Case filed under ${dispute.caseType}.`,
      `Claimant escrow posted: ${formatGen(dispute.escrow.claimantStakeWei)}.`,
      dispute.escrow.respondentDeposited
        ? `Respondent escrow posted: ${formatGen(dispute.escrow.respondentStakeWei)}.`
        : "Respondent escrow has not been posted yet.",
      dispute.respondentStatement
        ? "Respondent statement and supporting links were recorded."
        : "Respondent statement was not recorded in the current file.",
      dispute.issueMap
        ? "Issue mapping and credibility review were generated."
        : "Issue mapping has not yet been generated.",
      Object.keys(dispute.mediationPositions).length
        ? "Mediation positions were captured from one or more parties."
        : "No mediation position has been recorded in the current file.",
      dispute.escrow.settled
        ? `Escrow was settled with ${dispute.escrow.winner || "no"} prevailing party on record.`
        : "Escrow has not yet been settled.",
    ],
    evidenceIndex: [
      ...dispute.claimantEvidenceUrls.map((url, index) => `Claimant Exhibit C-${index + 1}: ${url}`),
      ...dispute.respondentEvidenceUrls.map(
        (url, index) => `Respondent Exhibit R-${index + 1}: ${url}`,
      ),
    ],
    findings: [
      dispute.issueMap || "No issue map available.",
      dispute.credibilityNotes || "No credibility notes available.",
    ],
    resolutionBasis: dispute.settlementOptions.length
      ? dispute.settlementOptions
      : [dispute.draftResolution || "No settlement or resolution basis available."],
    postResolutionActions: [
      dispute.finalTerms || "Publish enforceable final terms and settle escrow.",
      "Preserve evidence links and timeline records for third-party review.",
      "Archive payout receipts for claimant, respondent, and operator fee.",
    ],
  };
}

function isCaseParticipant(dispute: DisputeRecord, actor: string) {
  const current = normalized(actor);
  if (!current) return false;

  return Object.values(dispute.roles).some((addresses) =>
    addresses.some((address) => normalized(address) === current),
  );
}

export function CaseDetail({
  dispute,
  operator,
  connectedAddress,
  busy,
  onFundRespondentStake,
  onRespond,
  onAnalyze,
  onAdjudicate,
  onMediation,
  onFinalize,
  onAssignRole,
  onSubmitAppeal,
  onReviewAppeal,
}: CaseDetailProps) {
  const [responseStatement, setResponseStatement] = useState("");
  const [responseEvidence, setResponseEvidence] = useState("");
  const [mediationOption, setMediationOption] = useState<MediationInput["option"]>("A");
  const [mediationRationale, setMediationRationale] = useState("");
  const [finalTerms, setFinalTerms] = useState("");
  const [prevailingParty, setPrevailingParty] = useState<PrevailingParty>("CLAIMANT");
  const [loserPenaltyBps, setLoserPenaltyBps] = useState("7000");
  const [operatorFeeBps, setOperatorFeeBps] = useState("500");
  const [role, setRole] = useState<Exclude<RoleName, "claimant" | "respondent">>("counsel");
  const [roleAssignee, setRoleAssignee] = useState("");
  const [appealAction, setAppealAction] = useState("Reopen mediation");
  const [appealRationale, setAppealRationale] = useState("");
  const [appealEvidence, setAppealEvidence] = useState("");
  const [reviewDisposition, setReviewDisposition] =
    useState<AppealReviewInput["disposition"]>("UPHELD");
  const [reviewMemo, setReviewMemo] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!dispute) {
    return (
      <section className="panel panel-heavy">
        <h2>No case selected</h2>
        <p>Select a dispute from the board to inspect its current record and available actions.</p>
      </section>
    );
  }

  const currentDispute = dispute;
  const current = normalized(connectedAddress);
  const isClaimant = current !== "" && current === normalized(currentDispute.claimant);
  const isRespondent = current !== "" && current === normalized(currentDispute.respondent);
  const isOperator = current !== "" && current === normalized(operator);
  const isReviewer =
    currentDispute.roles.reviewer.some((address) => normalized(address) === current) || isOperator;
  const isRegulator =
    currentDispute.roles.regulator.some((address) => normalized(address) === current) || isOperator;
  const canAppeal =
    currentDispute.stage === "RESOLVED" && isCaseParticipant(currentDispute, connectedAddress);
  const policyPack = getPolicyPack(currentDispute.caseType);
  const regulatoryPacket = buildRegulatoryPacket(currentDispute);
  const requiredStakeLabel = formatGen(currentDispute.escrow.requiredStakeWei);
  const totalEscrowLabel = formatGen(currentDispute.escrow.totalEscrowWei);

  function exportCasePackage() {
    const payload = [
      "AccordMesh Case Package",
      `Case ID: ${currentDispute.id}`,
      `Title: ${currentDispute.title}`,
      `Type: ${currentDispute.caseType}`,
      `Stage: ${currentDispute.stage}`,
      `Required stake: ${requiredStakeLabel} per side`,
      `Total escrow: ${totalEscrowLabel}`,
      "",
      "Claimant Statement",
      currentDispute.claimantStatement,
      "",
      "Respondent Statement",
      currentDispute.respondentStatement || "Not submitted",
      "",
      "Issue Map",
      currentDispute.issueMap || "Not available",
      "",
      "Credibility Notes",
      currentDispute.credibilityNotes || "Not available",
      "",
      "Draft Resolution",
      currentDispute.draftResolution || "Not available",
      "",
      "Final Terms",
      currentDispute.finalTerms || "Not published",
    ].join("\n");

    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `accordmesh-case-${currentDispute.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportRegulatoryPacket() {
    const payload = [
      regulatoryPacket.coverTitle,
      "",
      "Executive Summary",
      regulatoryPacket.executiveSummary,
      "",
      "Jurisdiction Note",
      regulatoryPacket.jurisdictionNote,
      "",
      "Procedural History",
      ...regulatoryPacket.proceduralHistory.map((line) => `- ${line}`),
      "",
      "Evidence Index",
      ...(regulatoryPacket.evidenceIndex.length
        ? regulatoryPacket.evidenceIndex.map((line) => `- ${line}`)
        : ["- No evidence links recorded."]),
      "",
      "Findings",
      ...regulatoryPacket.findings.map((line) => `- ${line}`),
      "",
      "Resolution Basis",
      ...regulatoryPacket.resolutionBasis.map((line) => `- ${line}`),
      "",
      "Post-Resolution Actions",
      ...regulatoryPacket.postResolutionActions.map((line) => `- ${line}`),
    ].join("\n");

    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `accordmesh-regulatory-packet-${currentDispute.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openDecisionMemo() {
    const popup = window.open("", "_blank", "width=1080,height=920");
    if (!popup) return;

    popup.document.write(`
      <html>
        <head>
          <title>AccordMesh Decision Memo</title>
          <style>
            body { font-family: Georgia, serif; margin: 48px; color: #1d2430; background: #fffdf8; }
            h1,h2 { margin-bottom: 8px; }
            .meta { color: #6b7280; margin-bottom: 24px; }
            .block { margin-bottom: 24px; page-break-inside: avoid; }
            .card { border: 1px solid #d7d2c8; border-radius: 16px; padding: 18px; background: #fff; }
            ul { line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>${currentDispute.title}</h1>
          <div class="meta">Case ${currentDispute.id} · ${currentDispute.caseType} · ${getStageLabel(currentDispute.stage)}</div>
          <div class="block card"><h2>Executive Summary</h2><p>${regulatoryPacket.executiveSummary}</p></div>
          <div class="block card"><h2>Issue Map</h2><p>${currentDispute.issueMap || "Not available"}</p></div>
          <div class="block card"><h2>Decision Basis</h2><p>${currentDispute.draftResolution || currentDispute.finalTerms || "Not available"}</p></div>
          <div class="block card"><h2>Escrow Outcome</h2><p>Required stake: ${requiredStakeLabel}. Total escrow: ${totalEscrowLabel}. Winner: ${currentDispute.escrow.winner || "Pending"}.</p></div>
          <div class="block card"><h2>Final Terms</h2><p>${currentDispute.finalTerms || "Not published"}</p></div>
          <div class="block card"><h2>Evidence Index</h2><ul>${regulatoryPacket.evidenceIndex.map((item) => `<li>${item}</li>`).join("")}</ul></div>
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `);
    popup.document.close();
  }

  function run(task: () => Promise<void>) {
    startTransition(async () => {
      await task();
    });
  }

  function appendResponseEvidence(urls: string[]) {
    setResponseEvidence((currentValue) => [currentValue, ...urls].filter(Boolean).join(", "));
  }

  function appendAppealEvidence(urls: string[]) {
    setAppealEvidence((currentValue) => [currentValue, ...urls].filter(Boolean).join(", "));
  }

  return (
    <section className="panel panel-heavy">
      <div className="case-header">
        <div>
          <span className="eyebrow dark">{currentDispute.caseType}</span>
          <h2>{currentDispute.title}</h2>
        </div>
        <div className="score-badge">
          <strong>{getCaseReadiness(currentDispute)}%</strong>
          <span>Readiness</span>
        </div>
      </div>

      <div className="meta large-meta">
        <span>Case #{currentDispute.id}</span>
        <span>{getStageLabel(currentDispute.stage)}</span>
        <span>Escrow {totalEscrowLabel}</span>
        <span>Appeals {currentDispute.appeals.length}</span>
      </div>

      <div className="actions-row">
        <button className="button secondary" type="button" onClick={exportCasePackage}>
          Export case package
        </button>
        <button className="button secondary" type="button" onClick={exportRegulatoryPacket}>
          Export regulatory packet
        </button>
        <button className="button secondary" type="button" onClick={openDecisionMemo}>
          Open PDF-ready memo
        </button>
      </div>

      <div className="stack">
        <div className="briefing-card">
          <div>
            <span className="mini-kicker">Policy guidance</span>
            <h3>{policyPack.label}</h3>
          </div>
          <p>{policyPack.summary}</p>
          <div className="two-col compact-two-col">
            <div>
              <strong>Expected evidence</strong>
              <ul className="plain-list">
                {policyPack.requiredEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Likely remedies</strong>
              <ul className="plain-list">
                {policyPack.likelyRemedies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="role-grid">
          <div className="stage-card">
            <h3>Claimant</h3>
            <p className="mono">{currentDispute.claimant}</p>
            <p>Stake posted: {formatGen(currentDispute.escrow.claimantStakeWei)}</p>
          </div>
          <div className="stage-card">
            <h3>Respondent</h3>
            <p className="mono">{currentDispute.respondent}</p>
            <p>
              Stake posted:{" "}
              {currentDispute.escrow.respondentDeposited
                ? formatGen(currentDispute.escrow.respondentStakeWei)
                : "Pending"}
            </p>
          </div>
          <div className="stage-card">
            <h3>Operator</h3>
            <p className="mono">{operator || "Unbound"}</p>
            <p>Fee on ruling: {currentDispute.escrow.operatorFeeBps / 100}%</p>
          </div>
        </div>

        <div className="three-col">
          <div className="stage-card">
            <h3>Stake per side</h3>
            <p>{requiredStakeLabel}</p>
          </div>
          <div className="stage-card">
            <h3>Total escrow</h3>
            <p>{totalEscrowLabel}</p>
          </div>
          <div className="stage-card">
            <h3>Escrow status</h3>
            <p>
              {currentDispute.escrow.settled
                ? `Settled for ${currentDispute.escrow.winner}`
                : currentDispute.escrow.respondentDeposited
                  ? "Fully funded"
                  : "Waiting for respondent funding"}
            </p>
          </div>
        </div>

        {currentDispute.escrow.settled ? (
          <div className="three-col">
            <div className="stage-card">
              <h3>Winner payout</h3>
              <p>{formatGen(currentDispute.escrow.winnerPayoutWei)}</p>
            </div>
            <div className="stage-card">
              <h3>Loser refund</h3>
              <p>{formatGen(currentDispute.escrow.loserRefundWei)}</p>
            </div>
            <div className="stage-card">
              <h3>Operator fee</h3>
              <p>{formatGen(currentDispute.escrow.operatorFeeWei)}</p>
            </div>
          </div>
        ) : null}

        <div className="role-grid">
          {(["counsel", "reviewer", "regulator"] as const).map((roleName) => (
            <div className="stage-card" key={roleName}>
              <h3>{roleName}</h3>
              <ul className="plain-list">
                {currentDispute.roles[roleName].length ? (
                  currentDispute.roles[roleName].map((address) => (
                    <li className="mono" key={address}>
                      {address}
                    </li>
                  ))
                ) : (
                  <li>No assignees yet.</li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {isOperator ? (
          <div className="stage-card">
            <h3>Assign specialist role</h3>
            <div className="inline-form">
              <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                <option value="counsel">Counsel</option>
                <option value="reviewer">Reviewer</option>
                <option value="regulator">Regulator</option>
              </select>
              <input
                value={roleAssignee}
                onChange={(event) => setRoleAssignee(event.target.value)}
                placeholder="0x..."
              />
              <button
                className="button"
                type="button"
                disabled={busy || isPending || !roleAssignee.trim()}
                onClick={() =>
                  run(() =>
                    onAssignRole({
                      caseId: currentDispute.id,
                      role,
                      assignee: roleAssignee,
                    }),
                  )
                }
              >
                Assign
              </button>
            </div>
          </div>
        ) : null}

        <div className="two-col">
          <div className="stage-card">
            <h3>Claimant statement</h3>
            <p>{currentDispute.claimantStatement}</p>
          </div>
          <div className="stage-card">
            <h3>Respondent statement</h3>
            <p>{currentDispute.respondentStatement || "No response has been filed yet."}</p>
          </div>
        </div>

        <div className="two-col">
          <div className="stage-card">
            <h3>Claimant evidence</h3>
            <ul className="plain-list">
              {currentDispute.claimantEvidenceUrls.length ? (
                currentDispute.claimantEvidenceUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))
              ) : (
                <li>No links attached.</li>
              )}
            </ul>
          </div>
          <div className="stage-card">
            <h3>Respondent evidence</h3>
            <ul className="plain-list">
              {currentDispute.respondentEvidenceUrls.length ? (
                currentDispute.respondentEvidenceUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))
              ) : (
                <li>No links attached.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="two-col">
          <div className="stage-card">
            <h3>Issue map</h3>
            <p>{currentDispute.issueMap || "Run analysis once both sides have submitted the record."}</p>
          </div>
          <div className="stage-card">
            <h3>Credibility notes</h3>
            <p>{currentDispute.credibilityNotes || "No analysis has been published yet."}</p>
          </div>
        </div>

        <div className="stage-card">
          <h3>Settlement options</h3>
          <div className="option-list">
            {currentDispute.settlementOptions.length ? (
              currentDispute.settlementOptions.map((option) => (
                <div className="option-card" key={option}>
                  {option}
                </div>
              ))
            ) : (
              <div className="option-card">Settlement paths become available after analysis.</div>
            )}
          </div>
        </div>

        <div className="stage-card">
          <h3>Resolution and regulatory follow-through</h3>
          <p>{regulatoryPacket.executiveSummary}</p>
          <div className="two-col compact-two-col">
            <div>
              <strong>Procedural history</strong>
              <ul className="plain-list">
                {regulatoryPacket.proceduralHistory.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Post-resolution actions</strong>
              <ul className="plain-list">
                {regulatoryPacket.postResolutionActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="stage-card">
          <h3>Appeals</h3>
          <div className="list">
            {currentDispute.appeals.length ? (
              currentDispute.appeals.map((appeal, index) => (
                <div className="appeal-card" key={`${appeal.submittedBy}-${index}`}>
                  <div className="meta">
                    <span className="badge">{appeal.status}</span>
                    <span className="mono">{appeal.submittedBy}</span>
                  </div>
                  <strong>{appeal.requestedAction}</strong>
                  <p>{appeal.rationale}</p>
                  {appeal.evidenceUrls.length ? (
                    <ul className="plain-list">
                      {appeal.evidenceUrls.map((url) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noreferrer">
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {appeal.reviewMemo ? (
                    <p>
                      <strong>Review memo:</strong> {appeal.reviewMemo}
                    </p>
                  ) : null}
                  {(isReviewer || isRegulator) && appeal.status === "PENDING_REVIEW" ? (
                    <div className="form">
                      <div className="field">
                        <label>Disposition</label>
                        <select
                          value={reviewDisposition}
                          onChange={(event) =>
                            setReviewDisposition(event.target.value as AppealReviewInput["disposition"])
                          }
                        >
                          <option value="UPHELD">UPHELD</option>
                          <option value="REOPENED">REOPENED</option>
                          <option value="MODIFIED_TERMS">MODIFIED_TERMS</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Review memo</label>
                        <textarea
                          value={reviewMemo}
                          onChange={(event) => setReviewMemo(event.target.value)}
                        />
                      </div>
                      <button
                        className="button"
                        type="button"
                        disabled={busy || isPending || !reviewMemo.trim()}
                        onClick={() =>
                          run(() =>
                            onReviewAppeal({
                              caseId: currentDispute.id,
                              appealIndex: index,
                              disposition: reviewDisposition,
                              reviewMemo,
                            }),
                          )
                        }
                      >
                        Review appeal
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="option-card">No appeals have been filed yet.</div>
            )}
          </div>
        </div>

        {currentDispute.finalTerms ? (
          <div className="stage-card">
            <h3>Final terms</h3>
            <p>{currentDispute.finalTerms}</p>
          </div>
        ) : null}

        {currentDispute.stage === "STAKE_PENDING" && isRespondent ? (
          <div className="stage-card">
            <h3>Join dispute and post respondent stake</h3>
            <p>
              To contest this claim, the respondent must post the matching escrow amount of{" "}
              {requiredStakeLabel}.
            </p>
            <button
              className="button"
              type="button"
              disabled={busy || isPending}
              onClick={() => run(() => onFundRespondentStake(currentDispute.id))}
            >
              Deposit respondent stake
            </button>
          </div>
        ) : null}

        {currentDispute.stage === "RESPONSE_PENDING" && isRespondent ? (
          <div className="stage-card">
            <h3>Submit respondent response</h3>
            <div className="form">
              <div className="field">
                <label htmlFor="responseStatement">Respondent statement</label>
                <textarea
                  id="responseStatement"
                  value={responseStatement}
                  onChange={(event) => setResponseStatement(event.target.value)}
                />
              </div>
              <EvidenceUploader disabled={busy || isPending} onUploaded={appendResponseEvidence} />
              <div className="field">
                <label htmlFor="responseEvidence">Evidence URLs</label>
                <textarea
                  id="responseEvidence"
                  value={responseEvidence}
                  onChange={(event) => setResponseEvidence(event.target.value)}
                />
              </div>
              <button
                className="button"
                type="button"
                disabled={busy || isPending || !responseStatement.trim()}
                onClick={() =>
                  run(() =>
                    onRespond({
                      caseId: currentDispute.id,
                      respondentStatement: responseStatement,
                      evidenceUrls: responseEvidence,
                    }),
                  )
                }
              >
                Submit response
              </button>
            </div>
          </div>
        ) : null}

        {currentDispute.stage === "ANALYSIS_READY" ? (
          <div className="stage-card">
            <h3>Run AI analysis</h3>
            <p>
              This runs the issue map, credibility notes, and settlement-path generation on
              GenLayer after both escrow deposits and the respondent record are in place.
            </p>
            <button
              className="button"
              type="button"
              disabled={busy || isPending || current === ""}
              onClick={() => run(() => onAnalyze(currentDispute.id))}
            >
              Analyze case
            </button>
          </div>
        ) : null}

        {currentDispute.stage === "MEDIATION_OPEN" ? (
          <div className="stage-card">
            <strong>Adjudicate Dispute</strong>
            <p>
              Run leader-validator consensus to produce a binding verdict.
              Both nodes independently fetch evidence and evaluate the case.
            </p>
            <button
              className="button"
              type="button"
              disabled={busy || isPending || current === ""}
              onClick={() => run(() => onAdjudicate(currentDispute.id))}
            >
              Run Adjudication
            </button>
          </div>
        ) : null}

        {currentDispute.stage === "MEDIATION_OPEN" && (isClaimant || isRespondent) ? (
          <div className="stage-card">
            <h3>Record mediation position</h3>
            <div className="form">
              <div className="field">
                <label htmlFor="mediationOption">Option</label>
                <select
                  id="mediationOption"
                  value={mediationOption}
                  onChange={(event) =>
                    setMediationOption(event.target.value as MediationInput["option"])
                  }
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="REJECT">REJECT</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="mediationRationale">Rationale</label>
                <textarea
                  id="mediationRationale"
                  value={mediationRationale}
                  onChange={(event) => setMediationRationale(event.target.value)}
                />
              </div>
              <button
                className="button"
                type="button"
                disabled={busy || isPending || !mediationRationale.trim()}
                onClick={() =>
                  run(() =>
                    onMediation({
                      caseId: currentDispute.id,
                      option: mediationOption,
                      rationale: mediationRationale,
                    }),
                  )
                }
              >
                Save mediation position
              </button>
            </div>
          </div>
        ) : null}

        {currentDispute.stage === "MEDIATION_OPEN" && isOperator ? (
          <div className="stage-card">
            <h3>Issue ruling and settle escrow</h3>
            <div className="form">
              <div className="field">
                <label htmlFor="finalTerms">Final ruling</label>
                <textarea
                  id="finalTerms"
                  value={finalTerms}
                  onChange={(event) => setFinalTerms(event.target.value)}
                  placeholder="Summarize liability, remedy, deadlines, and why the winner prevailed."
                />
              </div>
              <div className="two-col">
                <div className="field">
                  <label>Winning side (from consensus)</label>
                  <div className="read-only-value" style={{ padding: "8px 12px", background: "var(--surface-container-low)", borderRadius: 4, fontWeight: 600 }}>
                    {currentDispute.adjudication?.verdict?.includes("CLAIMANT") ? "Claimant" : currentDispute.adjudication?.verdict?.includes("RESPONDENT") ? "Respondent" : currentDispute.adjudication?.verdict || "Run adjudication first"}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="loserPenaltyBps">Loser penalty (%)</label>
                  <input
                    id="loserPenaltyBps"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={String(Number(loserPenaltyBps) / 100)}
                    onChange={(event) =>
                      setLoserPenaltyBps(String(Math.round(Number(event.target.value || "0") * 100)))
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="operatorFeeBps">Operator fee (%)</label>
                <input
                  id="operatorFeeBps"
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={String(Number(operatorFeeBps) / 100)}
                  onChange={(event) =>
                    setOperatorFeeBps(String(Math.round(Number(event.target.value || "0") * 100)))
                  }
                />
              </div>
              <button
                className="button"
                type="button"
                disabled={
                  busy ||
                  isPending ||
                  !finalTerms.trim() ||
                  Number(loserPenaltyBps) + Number(operatorFeeBps) > 10000
                }
                onClick={() =>
                  run(() =>
                    onFinalize({
                      caseId: currentDispute.id,
                      finalTerms,
                      loserPenaltyBps: Number(loserPenaltyBps),
                      operatorFeeBps: Number(operatorFeeBps),
                    }),
                  )
                }
              >
                Settle escrow and publish ruling
              </button>
            </div>
          </div>
        ) : null}

        {canAppeal ? (
          <div className="stage-card">
            <h3>File appeal or oversight request</h3>
            <div className="form">
              <div className="field">
                <label>Requested action</label>
                <input
                  value={appealAction}
                  onChange={(event) => setAppealAction(event.target.value)}
                  placeholder="Reopen mediation"
                />
              </div>
              <div className="field">
                <label>Rationale</label>
                <textarea
                  value={appealRationale}
                  onChange={(event) => setAppealRationale(event.target.value)}
                />
              </div>
              <EvidenceUploader disabled={busy || isPending} onUploaded={appendAppealEvidence} />
              <div className="field">
                <label>Appeal evidence URLs</label>
                <textarea
                  value={appealEvidence}
                  onChange={(event) => setAppealEvidence(event.target.value)}
                />
              </div>
              <button
                className="button"
                type="button"
                disabled={busy || isPending || !appealRationale.trim() || !appealAction.trim()}
                onClick={() =>
                  run(() =>
                    onSubmitAppeal({
                      caseId: currentDispute.id,
                      requestedAction: appealAction,
                      rationale: appealRationale,
                      evidenceUrls: appealEvidence,
                    }),
                  )
                }
              >
                Submit appeal
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
