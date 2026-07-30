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
    <section className="table-panel">
      <div className="table-panel-head">
        <h2>Recent Disputes</h2>
        <div className="table-panel-tools">
          <span>{disputes.length} loaded</span>
        </div>
      </div>
      <div className="case-table-wrap">
        <table className="case-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Readiness</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {disputes.length ? (
              disputes.map((dispute) => (
                <tr className={selectedCaseId === dispute.id ? "is-selected" : ""} key={dispute.id}>
                  <td className="mono">{dispute.id}</td>
                  <td>
                    <strong>{dispute.title}</strong>
                    <p>{dispute.claimantStatement}</p>
                  </td>
                  <td>
                    <span className="table-chip">{dispute.caseType}</span>
                  </td>
                  <td>
                    <span className="badge">{getStageLabel(dispute.stage)}</span>
                  </td>
                  <td>{getCaseReadiness(dispute)}%</td>
                  <td>
                    <button className="table-action" type="button" onClick={() => onSelect(dispute.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="case-table-empty" colSpan={6}>
                  No disputes have been loaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
