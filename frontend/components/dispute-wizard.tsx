"use client";

import { useState, useTransition } from "react";
import { getPolicyPack, policyPacks } from "../lib/domain/policy-packs";
import type { NewDisputeInput } from "../lib/domain/types";
import { EvidenceUploader } from "./evidence-uploader";

const initialState: NewDisputeInput = {
  caseType: "Freelance delivery",
  title: "",
  respondent: "",
  claimantStatement: "",
  evidenceUrls: "",
};

type DisputeWizardProps = {
  disabled: boolean;
  onCreate(input: NewDisputeInput): Promise<void>;
};

export function DisputeWizard({ disabled, onCreate }: DisputeWizardProps) {
  const [form, setForm] = useState(initialState);
  const [isPending, startTransition] = useTransition();
  const activePack = getPolicyPack(form.caseType);

  function update<K extends keyof NewDisputeInput>(key: K, value: NewDisputeInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      await onCreate(form);
      setForm(initialState);
    });
  }

  function appendEvidence(urls: string[]) {
    setForm((current) => ({
      ...current,
      evidenceUrls: [current.evidenceUrls, ...urls].filter(Boolean).join(", "),
    }));
  }

  return (
    <section className="panel panel-heavy">
      <div className="section-top">
        <div>
          <span className="eyebrow dark">Claim Intake</span>
          <h2>File a dispute with a lawyer-style intake pack</h2>
        </div>
        <p>
          Build a file that already feels litigation-ready: counterparties, facts, exhibits,
          and remedy theory in one intake motion.
        </p>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="caseType">Dispute type</label>
          <select
            id="caseType"
            value={form.caseType}
            onChange={(event) => update("caseType", event.target.value)}
          >
            {policyPacks.map((pack) => (
              <option key={pack.id}>{pack.id}</option>
            ))}
          </select>
        </div>

        <div className="briefing-card">
          <div>
            <span className="mini-kicker">{activePack.label}</span>
            <h3>Intake blueprint</h3>
          </div>
          <p>{activePack.summary}</p>
          <div className="two-col compact-two-col">
            <div>
              <strong>Questions to answer</strong>
              <ul className="plain-list">
                {activePack.intakePrompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Evidence expected</strong>
              <ul className="plain-list">
                {activePack.requiredEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="title">Case title</label>
          <input
            id="title"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Milestone payment disputed after acceptance"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="respondent">Respondent address</label>
          <input
            id="respondent"
            value={form.respondent}
            onChange={(event) => update("respondent", event.target.value)}
            placeholder="0x..."
            required
          />
        </div>

        <div className="field">
          <label htmlFor="claimantStatement">Claimant statement</label>
          <textarea
            id="claimantStatement"
            value={form.claimantStatement}
            onChange={(event) => update("claimantStatement", event.target.value)}
            placeholder="Explain the agreement, the conduct in dispute, the strongest evidence, and the remedy requested."
            required
          />
        </div>

        <EvidenceUploader disabled={disabled || isPending} onUploaded={appendEvidence} />

        <div className="field">
          <label htmlFor="evidenceUrls">Evidence URLs</label>
          <textarea
            id="evidenceUrls"
            value={form.evidenceUrls}
            onChange={(event) => update("evidenceUrls", event.target.value)}
            placeholder="Uploaded links or external archive URLs"
          />
        </div>

        <button className="button" type="submit" disabled={disabled || isPending}>
          {isPending ? "Submitting..." : "File dispute"}
        </button>
      </form>
    </section>
  );
}
