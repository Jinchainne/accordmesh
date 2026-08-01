"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  DisputeRecord,
  NewDisputeInput,
  DisputeStage,
  MediationOptionKey,
  PrevailingParty,
} from "../lib/domain/types";
import {
  loadWorkspaceSnapshot,
  createDispute,
  fundRespondentStake,
  submitResponse,
  analyzeCase,
  adjudicateDispute,
  recordMediation,
  publishFinalTerms,
} from "../lib/services/dispute-service";
import {
  getActiveBrowserProvider,
  setActiveBrowserProvider,
  primeBrowserProviders,
  getDetectedWalletLabels,
} from "../lib/genlayer/wallet";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STUDIONET_CHAIN_ID = "0xf22f"; // 61999
const STUDIONET_CHAIN_ID_DEC = 61999;

type NavTab = "dashboard" | "cases" | "dispute" | "settlements";

const STAGE_LABELS: Record<DisputeStage, string> = {
  STAKE_PENDING: "Stake Pending",
  RESPONSE_PENDING: "Response Pending",
  ANALYSIS_READY: "Analysis Ready",
  MEDIATION_OPEN: "Mediation Open",
  RESOLVED: "Resolved",
};

const STAGE_ORDER: DisputeStage[] = [
  "STAKE_PENDING",
  "RESPONSE_PENDING",
  "ANALYSIS_READY",
  "MEDIATION_OPEN",
  "RESOLVED",
];

const WORKFLOW_STEPS = [
  { key: "file", label: "File Dispute", stage: "STAKE_PENDING" as DisputeStage },
  { key: "fund", label: "Fund Stake", stage: "STAKE_PENDING" as DisputeStage },
  { key: "respond", label: "Submit Response", stage: "RESPONSE_PENDING" as DisputeStage },
  { key: "analyze", label: "Analyze Case", stage: "ANALYSIS_READY" as DisputeStage },
  { key: "adjudicate", label: "Adjudicate", stage: "ANALYSIS_READY" as DisputeStage },
  { key: "mediate", label: "Mediation", stage: "MEDIATION_OPEN" as DisputeStage },
  { key: "final", label: "Final Terms", stage: "MEDIATION_OPEN" as DisputeStage },
];

const MEDIATION_OPTIONS: { key: MediationOptionKey; label: string; desc: string }[] = [
  { key: "A", label: "Option A", desc: "Accept settlement option A" },
  { key: "B", label: "Option B", desc: "Accept settlement option B" },
  { key: "C", label: "Option C", desc: "Accept settlement option C" },
  { key: "REJECT", label: "Reject", desc: "Reject all options — escalate" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function shortenAddr(addr: string): string {
  if (!addr) return "";
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function weiToGen(wei: string): string {
  try {
    const n = BigInt(wei);
    const gen = Number(n) / 1e18;
    return gen.toFixed(4);
  } catch {
    return "0.0000";
  }
}

function getStepIndexForStage(stage: DisputeStage, hasAdjudication: boolean, hasFinalTerms: boolean): number {
  if (hasFinalTerms) return 6;
  if (stage === "MEDIATION_OPEN" && hasAdjudication) return 5;
  if (stage === "ANALYSIS_READY" && hasAdjudication) return 4;
  if (stage === "ANALYSIS_READY") return 3;
  if (stage === "RESPONSE_PENDING") return 2;
  if (stage === "STAKE_PENDING") return 1;
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Home() {
  /* ---- wallet state ---- */
  const [walletAddr, setWalletAddr] = useState<string>("");
  const [walletChainId, setWalletChainId] = useState<string>("");
  const [walletError, setWalletError] = useState<string>("");

  /* ---- app state ---- */
  const [activeNav, setActiveNav] = useState<NavTab>("dashboard");
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<{ phase: "idle" | "pending" | "success" | "error"; label: string; hash?: string; detail?: string }>({ phase: "idle", label: "" });

  /* ---- new dispute form ---- */
  const [newDispute, setNewDispute] = useState<NewDisputeInput>({
    caseType: "",
    title: "",
    respondent: "",
    claimantStatement: "",
    evidenceUrls: "",
    stakeAmountGen: "0.1",
  });

  /* ---- response form ---- */
  const [responseStatement, setResponseStatement] = useState("");
  const [responseEvidence, setResponseEvidence] = useState("");

  /* ---- mediation ---- */
  const [mediationOption, setMediationOption] = useState<MediationOptionKey>("A");
  const [mediationRationale, setMediationRationale] = useState("");

  /* ---- final terms ---- */
  const [finalTermsText, setFinalTermsText] = useState("");
  const [prevailingParty, setPrevailingParty] = useState<PrevailingParty>("CLAIMANT");
  const [loserPenaltyBps, setLoserPenaltyBps] = useState(1000);
  const [operatorFeeBps, setOperatorFeeBps] = useState(200);

  /* ================================================================ */
  /*  Wallet Connection                                                */
  /* ================================================================ */

  const connectWallet = useCallback(async () => {
    setWalletError("");
    try {
      primeBrowserProviders();
      const provider = getActiveBrowserProvider();
      if (!provider) {
        setWalletError("No wallet detected. Install MetaMask or OKX Wallet.");
        return;
      }

      // Request accounts
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) {
        setWalletError("No accounts returned. Please unlock your wallet.");
        return;
      }

      // Check chain
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      setWalletChainId(chainId);
      setWalletAddr(accounts[0]);
      setActiveBrowserProvider(provider);

      // Switch to studionet if needed
      if (chainId !== STUDIONET_CHAIN_ID) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: STUDIONET_CHAIN_ID }],
          });
          setWalletChainId(STUDIONET_CHAIN_ID);
        } catch {
          // Try adding the chain
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: STUDIONET_CHAIN_ID,
                  chainName: "GenLayer Studio Network",
                  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
                  rpcUrls: ["https://studio.genlayer.com/api"],
                  blockExplorerUrls: ["https://explorer.genlayer.com"],
                },
              ],
            });
            setWalletChainId(STUDIONET_CHAIN_ID);
          } catch {
            setWalletError("Please switch to GenLayer Studionet (chain 61999) manually.");
          }
        }
      }

      // Listen for changes
      provider.on?.("accountsChanged", (...args: unknown[]) => {
        const accs = args[0] as string[];
        setWalletAddr(accs?.[0] ?? "");
      });
      provider.on?.("chainChanged", (...args: unknown[]) => {
        const cid = args[0] as string;
        setWalletChainId(cid);
      });
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Wallet connection failed.");
    }
  }, []);

  /* ================================================================ */
  /*  Data Loading                                                     */
  /* ================================================================ */

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const snapshot = await loadWorkspaceSnapshot();
      setDisputes(snapshot.disputes);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  /* ================================================================ */
  /*  Contract Actions                                                  */
  /* ================================================================ */

  const executeAction = async (label: string, action: () => Promise<string>) => {
    setTxStatus({ phase: "pending", label });
    try {
      const hash = await action();
      setTxStatus({ phase: "success", label, hash });
      await refreshData();
    } catch (err) {
      setTxStatus({ phase: "error", label, detail: err instanceof Error ? err.message : "Transaction failed" });
    }
  };

  const handleFileDispute = () => {
    executeAction("Filing dispute…", () => createDispute(newDispute, walletAddr));
  };

  const handleFundStake = () => {
    if (!selectedCaseId) return;
    executeAction("Funding respondent stake…", () => fundRespondentStake({ caseId: selectedCaseId }, walletAddr));
  };

  const handleSubmitResponse = () => {
    if (!selectedCaseId) return;
    executeAction("Submitting response…", () =>
      submitResponse({ caseId: selectedCaseId, respondentStatement: responseStatement, evidenceUrls: responseEvidence }, walletAddr)
    );
  };

  const handleAnalyzeCase = () => {
    if (!selectedCaseId) return;
    executeAction("Analyzing case (AI)…", () => analyzeCase(selectedCaseId, walletAddr));
  };

  const handleAdjudicate = () => {
    if (!selectedCaseId) return;
    executeAction("Adjudicating dispute…", () => adjudicateDispute(selectedCaseId, walletAddr));
  };

  const handleMediation = () => {
    if (!selectedCaseId) return;
    executeAction("Recording mediation position…", () =>
      recordMediation({ caseId: selectedCaseId, option: mediationOption, rationale: mediationRationale }, walletAddr)
    );
  };

  const handleFinalTerms = () => {
    if (!selectedCaseId) return;
    executeAction("Publishing final terms…", () =>
      publishFinalTerms(
        { caseId: selectedCaseId, finalTerms: finalTermsText, prevailingParty, loserPenaltyBps, operatorFeeBps },
        walletAddr
      )
    );
  };

  /* ================================================================ */
  /*  Derived Data                                                     */
  /* ================================================================ */

  const selectedCase = disputes.find((d) => d.id === selectedCaseId);
  const activeCount = disputes.filter((d) => d.stage !== "RESOLVED").length;
  const totalStaked = disputes.reduce((sum, d) => sum + Number(weiToGen(d.escrow.totalEscrowWei)), 0);
  const resolvedCount = disputes.filter((d) => d.stage === "RESOLVED").length;

  /* ================================================================ */
  /*  Sidebar                                                          */
  /* ================================================================ */

  const renderSidebar = () => (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">⚖</div>
        <div className="sidebar-brand-text">
          <strong>AccordMesh</strong>
          <span>Dispute Protocol</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {([
          { key: "dashboard", icon: "◉", label: "Dashboard" },
          { key: "cases", icon: "⊞", label: "My Cases" },
          { key: "dispute", icon: "⚑", label: "File Dispute" },
          { key: "settlements", icon: "✓", label: "Settlements" },
        ] as { key: NavTab; icon: string; label: string }[]).map((item) => (
          <button
            key={item.key}
            className={`sidebar-nav-item ${activeNav === item.key ? "is-active" : ""}`}
            onClick={() => setActiveNav(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="chain-badge">
          <span className="chain-dot" />
          <div className="chain-info">
            <span>Network</span>
            <strong>Studionet {walletChainId ? `(${parseInt(walletChainId, 16)})` : ""}</strong>
          </div>
        </div>
      </div>
    </aside>
  );

  /* ================================================================ */
  /*  Top Bar                                                          */
  /* ================================================================ */

  const renderTopbar = () => {
    const navLabels: Record<NavTab, { eyebrow: string; heading: string }> = {
      dashboard: { eyebrow: "Overview", heading: "Platform Dashboard" },
      cases: { eyebrow: "Casework", heading: "Active Case Queue" },
      dispute: { eyebrow: "New Case", heading: "File a Dispute" },
      settlements: { eyebrow: "Resolution", heading: "Settlement Pipeline" },
    };
    const { eyebrow, heading } = navLabels[activeNav];

    return (
      <header className="topbar">
        <div className="topbar-title">
          <span className="topbar-eyebrow">{eyebrow}</span>
          <strong className="topbar-heading">{heading}</strong>
        </div>
        <div className="topbar-actions">
          {walletAddr ? (
            <button className="wallet-chip" title={walletAddr}>
              <span className="wallet-dot" />
              <span className="wallet-addr">{shortenAddr(walletAddr)}</span>
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>
    );
  };

  /* ================================================================ */
  /*  Metrics Cards                                                    */
  /* ================================================================ */

  const renderMetrics = () => (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Active Disputes</span>
        <strong className="stat-value">{activeCount}</strong>
        <p className="stat-detail">{disputes.length} total cases</p>
        <span className="stat-icon">⊞</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Total Staked GEN</span>
        <strong className="stat-value">{totalStaked.toFixed(2)}</strong>
        <p className="stat-detail">Across all escrows</p>
        <span className="stat-icon">◈</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Resolution Rate</span>
        <strong className="stat-value">{disputes.length > 0 ? Math.round((resolvedCount / disputes.length) * 100) : 0}%</strong>
        <p className="stat-detail">{resolvedCount} resolved</p>
        <span className="stat-icon">✓</span>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Case Queue Table                                                 */
  /* ================================================================ */

  const renderCaseQueue = () => (
    <div className="table-panel">
      <div className="table-panel-head">
        <h2>Active Case Queue</h2>
        <span className="table-count">{disputes.length} cases</span>
      </div>
      <div className="case-table-wrap">
        <table className="case-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>Stage</th>
              <th>Staked</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {disputes.length === 0 ? (
              <tr>
                <td colSpan={6} className="case-table-empty">
                  {loading ? "Loading cases…" : "No disputes found. File a new case to get started."}
                </td>
              </tr>
            ) : (
              disputes.map((d) => (
                <tr key={d.id} onClick={() => { setSelectedCaseId(d.id); setActiveNav("cases"); }}>
                  <td><span className="case-id">#{d.id.slice(0, 8)}</span></td>
                  <td><strong>{d.title || "Untitled"}</strong></td>
                  <td><span className="text-muted">{d.caseType || "—"}</span></td>
                  <td><span className={`stage-badge ${d.stage.toLowerCase().replace(/_/g, "-")}`}>{STAGE_LABELS[d.stage]}</span></td>
                  <td><span className="mono">{weiToGen(d.escrow.totalEscrowWei)} GEN</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedCaseId(d.id); setActiveNav("cases"); }}>View →</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Workflow Stepper                                                  */
  /* ================================================================ */

  const renderWorkflow = () => {
    if (!selectedCase) {
      return (
        <div className="workflow-panel">
          <div className="workflow-panel-head">
            <h2>Dispute Workflow</h2>
          </div>
          <div className="step-content">
            <p className="text-muted">Select a case from the queue or file a new dispute to begin.</p>
          </div>
        </div>
      );
    }

    const currentStepIdx = getStepIndexForStage(selectedCase.stage, !!selectedCase.adjudication, !!selectedCase.finalTerms);

    return (
      <div className="workflow-panel">
        <div className="workflow-panel-head">
          <h2>Dispute Workflow — {selectedCase.title || `Case #${selectedCase.id.slice(0, 8)}`}</h2>
        </div>

        {/* Stepper */}
        <div className="stepper">
          {WORKFLOW_STEPS.map((step, i) => {
            const cls = i < currentStepIdx ? "is-done" : i === currentStepIdx ? "is-active" : "";
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                <div className={`step-item ${cls}`}>
                  <span className="step-num">{i < currentStepIdx ? "✓" : i + 1}</span>
                  {step.label}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && <div className="step-connector" />}
              </div>
            );
          })}
        </div>

        {/* TX status */}
        {txStatus.phase !== "idle" && (
          <div className="step-content" style={{ paddingTop: 0 }}>
            <div className={`tx-status ${txStatus.phase}`}>
              {txStatus.phase === "pending" && <span className="spinner" />}
              <span>{txStatus.label}</span>
              {txStatus.hash && <span className="tx-hash">{shortenAddr(txStatus.hash)}</span>}
              {txStatus.detail && <span>{txStatus.detail}</span>}
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="step-content">
          {renderStepContent(currentStepIdx)}
        </div>
      </div>
    );
  };

  const renderStepContent = (stepIdx: number) => {
    if (!selectedCase) return null;

    switch (stepIdx) {
      case 0: // File Dispute (already filed if case exists — show info)
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Dispute Filed ✓</h3>
            <p className="text-muted">This dispute has been filed and the claimant stake is deposited.</p>
            <div className="verdict-details" style={{ marginTop: 16 }}>
              <div className="verdict-detail-item">
                <span className="detail-label">Claimant</span>
                <span className="detail-value" style={{ fontSize: 13 }}>{shortenAddr(selectedCase.claimant)}</span>
              </div>
              <div className="verdict-detail-item">
                <span className="detail-label">Respondent</span>
                <span className="detail-value" style={{ fontSize: 13 }}>{shortenAddr(selectedCase.respondent)}</span>
              </div>
              <div className="verdict-detail-item" style={{ gridColumn: "1 / -1" }}>
                <span className="detail-label">Claimant Statement</span>
                <span className="detail-value" style={{ fontSize: 13, fontWeight: 400 }}>{selectedCase.claimantStatement || "No statement provided."}</span>
              </div>
            </div>
          </div>
        );

      case 1: // Fund Stake
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 2: Fund Respondent Stake</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              The respondent must deposit a matching stake of <strong className="mono">{weiToGen(selectedCase.escrow.requiredStakeWei)} GEN</strong> to proceed.
            </p>
            <div className="escrow-grid">
              <div className="escrow-item">
                <span className="escrow-label">Claimant Staked</span>
                <span className="escrow-value">{weiToGen(selectedCase.escrow.claimantStakeWei)}</span>
              </div>
              <div className="escrow-item">
                <span className="escrow-label">Respondent Staked</span>
                <span className="escrow-value">{weiToGen(selectedCase.escrow.respondentStakeWei)}</span>
              </div>
              <div className="escrow-item">
                <span className="escrow-label">Required</span>
                <span className="escrow-value">{weiToGen(selectedCase.escrow.requiredStakeWei)}</span>
              </div>
            </div>
            <div className="action-bar">
              <span className="text-muted">
                {selectedCase.escrow.respondentDeposited ? "✓ Respondent has deposited." : "Awaiting respondent deposit…"}
              </span>
              {!selectedCase.escrow.respondentDeposited && (
                <button className="btn btn-primary" onClick={handleFundStake} disabled={txStatus.phase === "pending"}>
                  Fund Respondent Stake
                </button>
              )}
            </div>
          </div>
        );

      case 2: // Submit Response
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 3: Submit Response</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              The respondent provides their statement and evidence URLs.
            </p>
            <div className="form-grid">
              <div className="form-field full-width">
                <label>Respondent Statement</label>
                <textarea
                  value={responseStatement}
                  onChange={(e) => setResponseStatement(e.target.value)}
                  placeholder="Provide your response to the claimant's allegations…"
                />
              </div>
              <div className="form-field full-width">
                <label>Evidence URLs (comma-separated)</label>
                <input
                  type="text"
                  value={responseEvidence}
                  onChange={(e) => setResponseEvidence(e.target.value)}
                  placeholder="https://example.com/evidence1.pdf, https://example.com/evidence2.png"
                  className="mono-input"
                />
              </div>
            </div>
            <div className="action-bar">
              <span className="text-muted">Submit as respondent</span>
              <button className="btn btn-primary" onClick={handleSubmitResponse} disabled={txStatus.phase === "pending" || !responseStatement}>
                Submit Response
              </button>
            </div>
          </div>
        );

      case 3: // Analyze Case
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 4: Analyze Case</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Trigger the AI analysis engine to examine evidence, build an issue map, and generate settlement options.
            </p>
            {selectedCase.issueMap && (
              <div className="verdict-detail-item" style={{ marginBottom: 16 }}>
                <span className="detail-label">Issue Map</span>
                <span className="detail-value" style={{ fontSize: 13, fontWeight: 400 }}>{selectedCase.issueMap}</span>
              </div>
            )}
            {selectedCase.credibilityNotes && (
              <div className="verdict-detail-item" style={{ marginBottom: 16 }}>
                <span className="detail-label">Credibility Notes</span>
                <span className="detail-value" style={{ fontSize: 13, fontWeight: 400 }}>{selectedCase.credibilityNotes}</span>
              </div>
            )}
            <div className="action-bar">
              <span className="text-muted">On-chain AI analysis</span>
              <button className="btn btn-accent" onClick={handleAnalyzeCase} disabled={txStatus.phase === "pending"}>
                Run Analysis
              </button>
            </div>
          </div>
        );

      case 4: // Adjudicate
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 5: Adjudicate</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Leader-validator consensus produces a verdict.
            </p>

            {selectedCase.adjudication ? (
              <div className="verdict-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={`verdict-badge ${selectedCase.adjudication.verdict.toLowerCase().includes("claimant") ? "claimant" : selectedCase.adjudication.verdict.toLowerCase().includes("respondent") ? "respondent" : selectedCase.adjudication.verdict.toLowerCase().includes("split") ? "split" : "undetermined"}`}>
                    {selectedCase.adjudication.verdict.replace(/_/g, " ")}
                  </span>
                  <span className="mono text-muted">Score: {selectedCase.adjudication.score}/100</span>
                </div>
                <p style={{ marginTop: 12, color: "var(--text)", fontSize: 14 }}>{selectedCase.adjudication.reason}</p>
                {selectedCase.adjudication.evidence_used.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <span className="detail-label">Evidence Used</span>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: 13 }}>
                      {selectedCase.adjudication.evidence_used.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="action-bar">
                <span className="text-muted">Requires analysis to be complete</span>
                <button className="btn btn-primary" onClick={handleAdjudicate} disabled={txStatus.phase === "pending"}>
                  Run Adjudication
                </button>
              </div>
            )}
          </div>
        );

      case 5: // Mediation
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 6: Mediation</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Parties choose from settlement options or reject.
            </p>

            {selectedCase.settlementOptions.length > 0 && (
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Available Settlement Options</label>
                <div className="mediation-grid" style={{ marginTop: 8 }}>
                  {MEDIATION_OPTIONS.map((opt) => {
                    const optionIdx = opt.key === "REJECT" ? -1 : opt.key.charCodeAt(0) - 65;
                    const optionText = optionIdx >= 0 && selectedCase.settlementOptions[optionIdx] ? selectedCase.settlementOptions[optionIdx] : opt.desc;
                    return (
                      <div
                        key={opt.key}
                        className={`mediation-option ${mediationOption === opt.key ? "is-selected" : ""}`}
                        onClick={() => setMediationOption(opt.key)}
                      >
                        <span className="option-key">{opt.key}</span>
                        <span className="option-label">{optionIdx >= 0 ? optionText : opt.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-grid">
              <div className="form-field full-width">
                <label>Rationale</label>
                <textarea
                  value={mediationRationale}
                  onChange={(e) => setMediationRationale(e.target.value)}
                  placeholder="Explain your reasoning for this position…"
                />
              </div>
            </div>

            {/* Show existing positions */}
            {Object.keys(selectedCase.mediationPositions).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <span className="detail-label">Recorded Positions</span>
                <div style={{ marginTop: 8 }}>
                  {Object.entries(selectedCase.mediationPositions).map(([addr, pos]) => (
                    <div key={addr} style={{ padding: "8px 0", borderBottom: "1px solid var(--card-border)", fontSize: 13 }}>
                      <span className="mono text-muted">{shortenAddr(addr)}</span>
                      <span style={{ marginLeft: 12, color: "var(--accent)" }}>→ Option {pos.option}</span>
                      <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{pos.rationale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="action-bar">
              <span className="text-muted">Record your mediation position</span>
              <button className="btn btn-primary" onClick={handleMediation} disabled={txStatus.phase === "pending" || !mediationRationale}>
                Submit Position
              </button>
            </div>
          </div>
        );

      case 6: // Final Terms
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 7: Final Terms</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              Operator resolves the dispute, sets escrow settlement terms.
            </p>

            {selectedCase.finalTerms ? (
              <div>
                <div className="verdict-card">
                  <h3 style={{ margin: "0 0 12px", color: "var(--text)" }}>Resolution Published</h3>
                  <p style={{ color: "var(--text)", fontSize: 14 }}>{selectedCase.finalTerms}</p>

                  {selectedCase.escrow.settled && (
                    <div className="escrow-grid" style={{ marginTop: 16 }}>
                      <div className="escrow-item">
                        <span className="escrow-label">Winner</span>
                        <span className="escrow-value" style={{ color: "var(--accent)" }}>{selectedCase.escrow.winner || "—"}</span>
                      </div>
                      <div className="escrow-item">
                        <span className="escrow-label">Winner Payout</span>
                        <span className="escrow-value" style={{ color: "var(--accent)" }}>{weiToGen(selectedCase.escrow.winnerPayoutWei)} GEN</span>
                      </div>
                      <div className="escrow-item">
                        <span className="escrow-label">Loser Refund</span>
                        <span className="escrow-value">{weiToGen(selectedCase.escrow.loserRefundWei)} GEN</span>
                      </div>
                    </div>
                  )}

                  {selectedCase.escrow.loserPenaltyBps > 0 && (
                    <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
                      Penalty: {selectedCase.escrow.loserPenaltyBps / 100}% from loser → winner. Operator fee: {selectedCase.escrow.operatorFeeBps / 100}%.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="form-field full-width">
                  <label>Final Terms</label>
                  <textarea
                    value={finalTermsText}
                    onChange={(e) => setFinalTermsText(e.target.value)}
                    placeholder="Describe the final resolution terms…"
                  />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Prevailing Party</label>
                    <select value={prevailingParty} onChange={(e) => setPrevailingParty(e.target.value as PrevailingParty)}>
                      <option value="CLAIMANT">Claimant</option>
                      <option value="RESPONDENT">Respondent</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Loser Penalty (bps)</label>
                    <input
                      type="number"
                      value={loserPenaltyBps}
                      onChange={(e) => setLoserPenaltyBps(Number(e.target.value))}
                      className="mono-input"
                    />
                    <span className="input-hint">{loserPenaltyBps / 100}% of loser's stake goes to winner</span>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Operator Fee (bps)</label>
                    <input
                      type="number"
                      value={operatorFeeBps}
                      onChange={(e) => setOperatorFeeBps(Number(e.target.value))}
                      className="mono-input"
                    />
                    <span className="input-hint">{operatorFeeBps / 100}% of total escrow</span>
                  </div>
                </div>
                <div className="action-bar">
                  <span className="text-muted">This action settles the escrow</span>
                  <button className="btn btn-accent" onClick={handleFinalTerms} disabled={txStatus.phase === "pending" || !finalTermsText}>
                    Publish Final Terms
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  /* ================================================================ */
  /*  File Dispute View                                                */
  /* ================================================================ */

  const renderFileDispute = () => (
    <div>
      <div className="section-header">
        <div>
          <h1>File a New Dispute</h1>
          <p>Submit a new case to the AccordMesh dispute resolution system. A claimant stake is required.</p>
        </div>
      </div>

      <div className="workflow-panel">
        <div className="step-content">
          <div className="form-grid">
            <div className="form-row">
              <div className="form-field">
                <label>Case Type</label>
                <input
                  type="text"
                  value={newDispute.caseType}
                  onChange={(e) => setNewDispute({ ...newDispute, caseType: e.target.value })}
                  placeholder="e.g., Contract Breach, IP Dispute"
                />
              </div>
              <div className="form-field">
                <label>Stake Amount (GEN)</label>
                <input
                  type="text"
                  value={newDispute.stakeAmountGen}
                  onChange={(e) => setNewDispute({ ...newDispute, stakeAmountGen: e.target.value })}
                  placeholder="0.1"
                  className="mono-input"
                />
              </div>
            </div>

            <div className="form-field">
              <label>Case Title</label>
              <input
                type="text"
                value={newDispute.title}
                onChange={(e) => setNewDispute({ ...newDispute, title: e.target.value })}
                placeholder="Brief description of the dispute"
              />
            </div>

            <div className="form-field">
              <label>Respondent Address</label>
              <input
                type="text"
                value={newDispute.respondent}
                onChange={(e) => setNewDispute({ ...newDispute, respondent: e.target.value })}
                placeholder="0x…"
                className="mono-input"
              />
            </div>

            <div className="form-field">
              <label>Claimant Statement</label>
              <textarea
                value={newDispute.claimantStatement}
                onChange={(e) => setNewDispute({ ...newDispute, claimantStatement: e.target.value })}
                placeholder="Describe your claim in detail…"
              />
            </div>

            <div className="form-field">
              <label>Evidence URLs (comma-separated)</label>
              <input
                type="text"
                value={newDispute.evidenceUrls}
                onChange={(e) => setNewDispute({ ...newDispute, evidenceUrls: e.target.value })}
                placeholder="https://example.com/evidence1.pdf, https://example.com/evidence2.png"
                className="mono-input"
              />
            </div>

            {txStatus.phase !== "idle" && (
              <div className={`tx-status ${txStatus.phase}`}>
                {txStatus.phase === "pending" && <span className="spinner" />}
                <span>{txStatus.label}</span>
                {txStatus.hash && <span className="tx-hash">{shortenAddr(txStatus.hash)}</span>}
                {txStatus.detail && <span>{txStatus.detail}</span>}
              </div>
            )}

            <div className="action-bar">
              <span className="text-muted">Requires wallet connection &amp; GEN stake</span>
              <div className="action-bar-right">
                <button className="btn btn-secondary" onClick={() => setActiveNav("dashboard")}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleFileDispute}
                  disabled={txStatus.phase === "pending" || !walletAddr || !newDispute.title || !newDispute.respondent}
                >
                  {txStatus.phase === "pending" ? "Filing…" : "File Dispute & Stake"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Settlements View                                                 */
  /* ================================================================ */

  const renderSettlements = () => {
    const resolvedCases = disputes.filter((d) => d.stage === "RESOLVED");
    return (
      <div>
        <div className="section-header">
          <div>
            <h1>Settlements</h1>
            <p>View resolved disputes and escrow settlements.</p>
          </div>
        </div>

        {resolvedCases.length === 0 ? (
          <div className="workflow-panel">
            <div className="step-content">
              <p className="text-muted">No resolved disputes yet.</p>
            </div>
          </div>
        ) : (
          <div className="table-panel">
            <div className="table-panel-head">
              <h2>Resolved Cases</h2>
              <span className="table-count">{resolvedCases.length}</span>
            </div>
            <div className="case-table-wrap">
              <table className="case-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Title</th>
                    <th>Winner</th>
                    <th>Payout</th>
                    <th>Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedCases.map((d) => (
                    <tr key={d.id} onClick={() => { setSelectedCaseId(d.id); setActiveNav("cases"); }}>
                      <td><span className="case-id">#{d.id.slice(0, 8)}</span></td>
                      <td><strong>{d.title || "Untitled"}</strong></td>
                      <td><span className="text-accent">{d.escrow.winner || "—"}</span></td>
                      <td><span className="mono">{weiToGen(d.escrow.winnerPayoutWei)} GEN</span></td>
                      <td><span className="mono">{d.escrow.loserPenaltyBps / 100}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ================================================================ */
  /*  Main Content Router                                              */
  /* ================================================================ */

  const renderContent = () => {
    switch (activeNav) {
      case "dashboard":
        return (
          <div className="dashboard-content">
            <div className="section-header">
              <div>
                <h1>AccordMesh</h1>
                <p>GenLayer-native decentralized dispute resolution platform</p>
              </div>
              {!walletAddr && (
                <button className="btn btn-primary" onClick={connectWallet}>
                  Connect Wallet
                </button>
              )}
            </div>
            {walletError && (
              <div className="tx-status error">{walletError}</div>
            )}
            {renderMetrics()}
            {renderCaseQueue()}
          </div>
        );

      case "cases":
        return (
          <div className="dashboard-content">
            {renderCaseQueue()}
            {renderWorkflow()}
          </div>
        );

      case "dispute":
        return (
          <div className="dashboard-content">
            {renderFileDispute()}
          </div>
        );

      case "settlements":
        return (
          <div className="dashboard-content">
            {renderSettlements()}
          </div>
        );
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="dashboard-frame">
      {renderSidebar()}
      <main className="dashboard-main">
        {renderTopbar()}
        {renderContent()}
      </main>
    </div>
  );
}
