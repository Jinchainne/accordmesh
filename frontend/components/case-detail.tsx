"use client";

import { useState, useTransition } from "react";
import { getCaseReadiness, getStageLabel } from "../lib/domain/derived";
import { getPolicyPack } from "../lib/domain/policy-packs";
import type {
  DisputeRecord,
  FinalTermsInput,
  MediationInput,
  ResponseInput,
} from "../lib/domain/types";

type CaseDetailProps = {
  dispute: DisputeRecord | null;
  operator: string;
  connectedAddress: string;
  busy: boolean;
  onRespond(input: ResponseInput): Promise<void>;
  onAnalyze(caseId: string): Promise<void>;
  onMediation(input: MediationInput): Promise<void>;
  onFinalize(input: FinalTermsInput): Promise<void>;
};

function normalized(value: string) {
  return value.trim().toLowerCase();
}

export function CaseDetail({
  dispute,
  operator,
  connectedAddress,
  busy,
  onRespond,
  onAnalyze,
  onMediation,
  onFinalize,
}: CaseDetailProps) {
  const [responseStatement, setResponseStatement] = useState("");
  const [responseEvidence, setResponseEvidence] = useState("");
  const [mediationOption, setMediationOption] = useState<MediationInput["option"]>("A");
  const [mediationRationale, setMediationRationale] = useState("");
  const [finalTerms, setFinalTerms] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!dispute) {
    return (
      <section className="panel">
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
  const policyPack = getPolicyPack(currentDispute.caseType);

  function exportCasePackage() {
    const payload = [
      "AccordMesh Case Package",
      `Case ID: ${currentDispute.id}`,
      `Title: ${currentDispute.title}`,
      `Type: ${currentDispute.caseType}`,
      `Stage: ${currentDispute.stage}`,
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

  function run(task: () => Promise<void>) {
    startTransition(async () => {
      await task();
    });
  }

  return (
    <section className="panel">
      <div className="meta">
        <span className="badge warn">{dispute.caseType}</span>
        <span>Case #{dispute.id}</span>
        <span>Readiness {getCaseReadiness(dispute)}%</span>
      </div>
      <h2>{dispute.title}</h2>
      <p>
        <strong>Stage:</strong> {getStageLabel(dispute.stage)}
      </p>
      <div className="actions-row">
        <button className="button secondary" type="button" onClick={exportCasePackage}>
          Export case package
        </button>
      </div>

      <div className="stack">
        <div className="stage-card">
          <h3>Policy pack guidance</h3>
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

        <div className="stage-card">
          <h3>Parties</h3>
          <p>
            <strong>Claimant:</strong> <span className="mono">{dispute.claimant}</span>
          </p>
          <p>
            <strong>Respondent:</strong> <span className="mono">{dispute.respondent}</span>
          </p>
        </div>

        <div className="stage-card">
          <h3>Statements</h3>
          <p>
            <strong>Claimant:</strong> {dispute.claimantStatement}
          </p>
          <p>
            <strong>Respondent:</strong>{" "}
            {dispute.respondentStatement || "No response has been filed yet."}
          </p>
        </div>

        <div className="two-col">
          <div className="stage-card">
            <h3>Claimant evidence</h3>
            <ul className="plain-list">
              {dispute.claimantEvidenceUrls.length ? (
                dispute.claimantEvidenceUrls.map((url) => (
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
              {dispute.respondentEvidenceUrls.length ? (
                dispute.respondentEvidenceUrls.map((url) => (
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

        <div className="stage-card">
          <h3>Issue map</h3>
          <p>{dispute.issueMap || "Run analysis once both sides have submitted the record."}</p>
        </div>

        <div className="stage-card">
          <h3>Credibility notes</h3>
          <p>{dispute.credibilityNotes || "No analysis has been published yet."}</p>
        </div>

        <div className="stage-card">
          <h3>Settlement options</h3>
          <div className="option-list">
            {dispute.settlementOptions.length ? (
              dispute.settlementOptions.map((option) => (
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
          <h3>Draft resolution memo</h3>
          <p>{dispute.draftResolution || "No draft resolution published yet."}</p>
        </div>

        <div className="stage-card">
          <h3>Mediation positions</h3>
          <ul className="plain-list">
            {Object.entries(dispute.mediationPositions).length ? (
              Object.entries(dispute.mediationPositions).map(([party, position]) => (
                <li key={party}>
                  <span className="mono">{party}</span> chose <strong>{position.option}</strong>:{" "}
                  {position.rationale}
                </li>
              ))
            ) : (
              <li>No party positions have been recorded yet.</li>
            )}
          </ul>
        </div>

        {dispute.finalTerms ? (
          <div className="stage-card">
            <h3>Final terms</h3>
            <p>{dispute.finalTerms}</p>
          </div>
        ) : null}

        {dispute.stage === "RESPONSE_PENDING" && isRespondent ? (
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
              <div className="field">
                <label htmlFor="responseEvidence">Evidence URLs</label>
                <input
                  id="responseEvidence"
                  value={responseEvidence}
                  onChange={(event) => setResponseEvidence(event.target.value)}
                  placeholder="https://..."
                />
              </div>
              <button
                className="button"
                type="button"
                disabled={busy || isPending || !responseStatement.trim()}
                onClick={() =>
                  run(() =>
                    onRespond({
                      caseId: dispute.id,
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

        {dispute.stage === "ANALYSIS_READY" ? (
          <div className="stage-card">
            <h3>Run AI analysis</h3>
            <p>
              This calls the contract&apos;s GenLayer analysis step to create the issue map,
              credibility notes, and mediation options.
            </p>
            <button
              className="button"
              type="button"
              disabled={busy || isPending || current === ""}
              onClick={() => run(() => onAnalyze(dispute.id))}
            >
              Analyze case
            </button>
          </div>
        ) : null}

        {dispute.stage === "MEDIATION_OPEN" && (isClaimant || isRespondent) ? (
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
                      caseId: dispute.id,
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

        {dispute.stage === "MEDIATION_OPEN" && isOperator ? (
          <div className="stage-card">
            <h3>Publish final terms</h3>
            <div className="form">
              <div className="field">
                <label htmlFor="finalTerms">Final terms</label>
                <textarea
                  id="finalTerms"
                  value={finalTerms}
                  onChange={(event) => setFinalTerms(event.target.value)}
                  placeholder="Summarize the agreed or imposed resolution terms."
                />
              </div>
              <button
                className="button"
                type="button"
                disabled={busy || isPending || !finalTerms.trim()}
                onClick={() =>
                  run(() =>
                    onFinalize({
                      caseId: dispute.id,
                      finalTerms,
                    }),
                  )
                }
              >
                Publish final terms
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
