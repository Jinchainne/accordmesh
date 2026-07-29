"use client";

import type { TransactionState } from "../lib/domain/types";

export function TransactionStatusPanel({ transaction }: { transaction: TransactionState }) {
  if (transaction.phase === "idle") {
    return null;
  }

  return (
    <section className="panel">
      <div className="meta">
        <span className={`badge ${transaction.phase === "error" ? "danger" : ""}`}>
          {transaction.phase}
        </span>
        <span>{transaction.label}</span>
      </div>
      {transaction.hash ? (
        <p>
          Transaction hash: <span className="mono">{transaction.hash}</span>
        </p>
      ) : null}
      {transaction.detail ? <p>{transaction.detail}</p> : null}
    </section>
  );
}

