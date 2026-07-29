"use client";

import { getCaseReadiness, getStageLabel } from "../lib/domain/derived";
import type { DisputeRecord } from "../lib/domain/types";

type CaseListProps = {
  disputes: DisputeRecord[];
  selectedCaseId: string;
  onSelect(caseId: string): void;
};

export function CaseList({ disputes, selectedCaseId, onSelect }: CaseListProps) {
  return (
    <section className="panel">
      <div className="section-top compact">
        <div>
          <span className="eyebrow dark">Case Board</span>
          <h2>Active files</h2>
        </div>
        <p>{disputes.length} records loaded across intake, mediation, and post-resolution review.</p>
      </div>
      <div className="list">
        {disputes.map((dispute) => (
          <button
            className={`case-card button-reset ${selectedCaseId === dispute.id ? "selected" : ""}`}
            key={dispute.id}
            type="button"
            onClick={() => onSelect(dispute.id)}
          >
            <div className="meta">
              <span className="badge">{getStageLabel(dispute.stage)}</span>
              <span>{dispute.caseType}</span>
              <span>{dispute.appeals.length} appeals</span>
            </div>
            <div className="case-card-top">
              <h3>{dispute.title}</h3>
              <div className="readiness-pill">{getCaseReadiness(dispute)}%</div>
            </div>
            <p>{dispute.claimantStatement}</p>
            <div className="case-rail" />
            <div className="meta">
              <span>{dispute.claimantEvidenceUrls.length} claimant exhibits</span>
              <span>{dispute.respondentEvidenceUrls.length} respondent exhibits</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
