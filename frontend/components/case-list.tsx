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
          <span className="eyebrow dark">Cases</span>
          <h2>Open files</h2>
        </div>
        <p>{disputes.length} matters loaded.</p>
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
              <span>{dispute.appeals.length} appeal{dispute.appeals.length === 1 ? "" : "s"}</span>
            </div>
            <div className="case-card-top">
              <h3>{dispute.title}</h3>
              <div className="readiness-pill">{getCaseReadiness(dispute)}%</div>
            </div>
            <p>{dispute.claimantStatement}</p>
            <div className="case-rail" />
            <div className="meta">
              <span>{dispute.claimantEvidenceUrls.length} claimant items</span>
              <span>{dispute.respondentEvidenceUrls.length} respondent items</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
