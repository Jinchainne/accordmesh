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
      <div className="meta">
        <span className="badge">Case board</span>
        <span>{disputes.length} records loaded</span>
      </div>
      <h2>Dispute files</h2>
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
              <span>Readiness {getCaseReadiness(dispute)}%</span>
            </div>
            <h3>{dispute.title}</h3>
            <p>{dispute.claimantStatement}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
