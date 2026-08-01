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
} from "../lib/genlayer/wallet";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STUDIONET_CHAIN_ID = "0xf22f";

const STAGE_LABELS: Record<DisputeStage, string> = {
  STAKE_PENDING: "Open",
  RESPONSE_PENDING: "Open",
  ANALYSIS_READY: "Analysis",
  MEDIATION_OPEN: "Mediation",
  RESOLVED: "Resolved",
};

const STAGE_FILTER_MAP: Record<string, DisputeStage | null> = {
  "All Stages": null,
  "Open": "STAKE_PENDING",
  "Analysis": "ANALYSIS_READY",
  "Mediation": "MEDIATION_OPEN",
};

const WORKFLOW_STEPS = [
  { key: "file", label: "File Dispute", stage: "STAKE_PENDING" as DisputeStage },
  { key: "fund", label: "Fund Stake", stage: "STAKE_PENDING" as DisputeStage },
  { key: "respond", label: "Submit Response", stage: "RESPONSE_PENDING" as DisputeStage },
  { key: "analyze", label: "Analyze Case", stage: "ANALYSIS_READY" as DisputeStage },
  { key: "adjudicate", label: "Adjudicate", stage: "MEDIATION_OPEN" as DisputeStage },
  { key: "mediate", label: "Mediation", stage: "MEDIATION_OPEN" as DisputeStage },
  { key: "final", label: "Final Terms", stage: "MEDIATION_OPEN" as DisputeStage },
];

const MEDIATION_OPTIONS: { key: MediationOptionKey; label: string; desc: string }[] = [
  { key: "A", label: "Option A", desc: "Accept settlement option A" },
  { key: "B", label: "Option B", desc: "Accept settlement option B" },
  { key: "C", label: "Option C", desc: "Accept settlement option C" },
  { key: "REJECT", label: "Reject", desc: "Reject all — escalate" },
];

const NAV_ITEMS = [
  { key: "dashboard", icon: "◉", label: "Dashboard" },
  { key: "cases", icon: "⊞", label: "Case Queue" },
  { key: "analytics", icon: "◈", label: "Analytics" },
  { key: "stake", icon: "⬡", label: "Stake GEN" },
  { key: "settings", icon: "⚙", label: "Settings" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

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
  if (stage === "MEDIATION_OPEN") return 4;
  if (stage === "ANALYSIS_READY") return 3;
  if (stage === "RESPONSE_PENDING") return 2;
  if (stage === "STAKE_PENDING") return 1;
  return 0;
}

function stageToFilterMatch(stage: DisputeStage, filter: string): boolean {
  const mapped = STAGE_FILTER_MAP[filter];
  if (mapped === null || mapped === undefined) return true;
  if (filter === "Open") return stage === "STAKE_PENDING" || stage === "RESPONSE_PENDING";
  return stage === mapped;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

function getMockDisputes(): DisputeRecord[] {
  return [
    {
      id: "ACD-8821", caseType: "Technical", title: "Smart Contract Audit Dispute: VaultX",
      stage: "ANALYSIS_READY" as DisputeStage, claimant: "0x3637...34bd", respondent: "0x9abc...def0",
      claimantStatement: "The reentrancy vulnerability in VaultX's withdraw function is severity CRITICAL, not medium as the auditor claims. Funds are at risk.",
      respondentStatement: "The audit followed standard methodology. The reentrancy guard mitigates the risk to low severity.",
      claimantEvidenceUrls: ["https://example.com/audit-report.pdf"], respondentEvidenceUrls: ["https://example.com/audit-methodology.md"],
      issueMap: "1. Severity classification dispute\n2. Reentrancy guard effectiveness\n3. Potential fund exposure",
      credibilityNotes: "Claimant evidence is stronger: independent audit report confirms CRITICAL severity.",
      settlementOptions: ["Option A: Immediate patch + partial refund", "Option B: Re-audit with neutral third party", "Option C: Cap liability at 50% of audit fee"],
      draftResolution: "Based on evidence, the reentrancy vulnerability is confirmed CRITICAL. Recommend partial refund of audit fee.",
      mediationPositions: {}, finalTerms: "",
      roles: { claimant: ["0x3637...34bd"], respondent: ["0x9abc...def0"], counsel: [], reviewer: [], regulator: [] },
      appeals: [], escrow: { requiredStakeWei: "45000000000000000000000", claimantStakeWei: "45000000000000000000000", respondentStakeWei: "45000000000000000000000", claimantDeposited: true, respondentDeposited: true, totalEscrowWei: "90000000000000000000000", winner: "", loserPenaltyBps: 0, operatorFeeBps: 0, winnerPayoutWei: "0", loserRefundWei: "0", operatorFeeWei: "0", settled: false },
      adjudication: { verdict: "CLAIMANT_FAVORED", confidence: "high", score: 82, reason: "Independent audit confirms CRITICAL severity. Respondent's methodology defense is insufficient.", evidence_used: ["Audit report", "Reentrancy test results", "VaultX code review"], fetched_sources_summary: ["Fetched audit report confirms CRITICAL finding"] },
    },
    {
      id: "ACD-8819", caseType: "Governance", title: "DAO Treasury Misallocation Claim",
      stage: "MEDIATION_OPEN" as DisputeStage, claimant: "0x1111...2222", respondent: "0x3333...4444",
      claimantStatement: "Proposal #44 allocated treasury funds to a project not approved by governance vote.",
      respondentStatement: "The allocation was within the delegated authority of the treasury committee.",
      claimantEvidenceUrls: ["https://example.com/proposal-44.pdf"], respondentEvidenceUrls: ["https://example.com/treasury-charter.md"],
      issueMap: "1. Scope of treasury committee authority\n2. Whether Proposal #44 required governance vote",
      credibilityNotes: "Both sides present valid constitutional arguments. Charter language is ambiguous.",
      settlementOptions: ["Option A: Return funds + ratify via governance", "Option B: Partial return + charter amendment", "Option C: Uphold allocation + clarify charter"],
      draftResolution: "The charter language is ambiguous. Recommend governance ratification vote.",
      mediationPositions: {}, finalTerms: "",
      roles: { claimant: ["0x1111...2222"], respondent: ["0x3333...4444"], counsel: [], reviewer: [], regulator: [] },
      appeals: [], escrow: { requiredStakeWei: "120500000000000000000000", claimantStakeWei: "120500000000000000000000", respondentStakeWei: "120500000000000000000000", claimantDeposited: true, respondentDeposited: true, totalEscrowWei: "241000000000000000000000", winner: "", loserPenaltyBps: 0, operatorFeeBps: 0, winnerPayoutWei: "0", loserRefundWei: "0", operatorFeeWei: "0", settled: false },
    },
    {
      id: "ACD-8815", caseType: "Data Integrity", title: "Oracle Price Feed Manipulation",
      stage: "STAKE_PENDING" as DisputeStage, claimant: "0x5555...6666", respondent: "0x7777...8888",
      claimantStatement: "Abnormal price spikes in the lending protocol were caused by oracle manipulation.",
      respondentStatement: "The price feed operated correctly within normal market volatility.",
      claimantEvidenceUrls: [], respondentEvidenceUrls: [],
      issueMap: "", credibilityNotes: "", settlementOptions: [], draftResolution: "",
      mediationPositions: {}, finalTerms: "",
      roles: { claimant: ["0x5555...6666"], respondent: ["0x7777...8888"], counsel: [], reviewer: [], regulator: [] },
      appeals: [], escrow: { requiredStakeWei: "8250000000000000000000", claimantStakeWei: "8250000000000000000000", respondentStakeWei: "0", claimantDeposited: true, respondentDeposited: false, totalEscrowWei: "8250000000000000000000", winner: "", loserPenaltyBps: 0, operatorFeeBps: 0, winnerPayoutWei: "0", loserRefundWei: "0", operatorFeeWei: "0", settled: false },
    },
  ];
}

export default function Home() {
  /* ---- wallet state ---- */
  const [walletAddr, setWalletAddr] = useState<string>("");
  const [walletChainId, setWalletChainId] = useState<string>("");

  /* ---- app state ---- */
  const [activeNav, setActiveNav] = useState<NavKey>("cases");
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<{ phase: "idle" | "pending" | "success" | "error"; label: string; hash?: string; detail?: string }>({ phase: "idle", label: "" });

  /* ---- search / filter ---- */
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Stages");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  /* ---- new dispute form (for File Dispute button in sidebar) ---- */
  const [showFileDispute, setShowFileDispute] = useState(false);
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
    try {
      primeBrowserProviders();
      const provider = getActiveBrowserProvider();
      if (!provider) return;

      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) return;

      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      setWalletChainId(chainId);
      setWalletAddr(accounts[0]);
      setActiveBrowserProvider(provider);

      if (chainId !== STUDIONET_CHAIN_ID) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: STUDIONET_CHAIN_ID }],
          });
          setWalletChainId(STUDIONET_CHAIN_ID);
        } catch {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: STUDIONET_CHAIN_ID,
                chainName: "GenLayer Studio Network",
                nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
                rpcUrls: ["https://studio.genlayer.com/api"],
                blockExplorerUrls: ["https://explorer.genlayer.com"],
              }],
            });
            setWalletChainId(STUDIONET_CHAIN_ID);
          } catch { /* ignore */ }
        }
      }

      provider.on?.("accountsChanged", (...args: unknown[]) => {
        const accs = args[0] as string[];
        setWalletAddr(accs?.[0] ?? "");
      });
      provider.on?.("chainChanged", (...args: unknown[]) => {
        const cid = args[0] as string;
        setWalletChainId(cid);
      });
    } catch { /* ignore */ }
  }, []);

  /* ================================================================ */
  /*  Data Loading                                                     */
  /* ================================================================ */

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      // Race with 8s timeout so mock data appears if RPC hangs
      const snapshot = await Promise.race([
        loadWorkspaceSnapshot(),
        new Promise<{ disputes: DisputeRecord[] }>((_, reject) => setTimeout(() => reject(new Error("RPC timeout")), 8000)),
      ]);
      if (snapshot.disputes.length > 0) {
        setDisputes(snapshot.disputes);
      } else {
        setDisputes(getMockDisputes());
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      setDisputes(getMockDisputes());
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

  const filteredDisputes = disputes.filter((d) => {
    const matchesSearch = !searchQuery ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.includes(searchQuery) ||
      d.caseType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageToFilterMatch(d.stage, activeFilter);
    return matchesSearch && matchesStage;
  });

  const totalPages = Math.max(1, Math.ceil(filteredDisputes.length / PAGE_SIZE));
  const paginatedDisputes = filteredDisputes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ================================================================ */
  /*  Sidebar                                                          */
  /* ================================================================ */

  const renderSidebar = () => (
    <aside className="app-sidebar">
      <div>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">⚖</div>
          <div className="sidebar-brand-text">
            <strong>AccordMesh</strong>
            <span>Decentralized Justice</span>
          </div>
        </div>
        <button className="sidebar-file-btn" onClick={() => { setShowFileDispute(true); setActiveNav("cases"); }}>
          + File a Dispute
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
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
        <div className="sidebar-footer-link">📄 Documentation</div>
        <div className="sidebar-footer-link">💬 Support</div>
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

  const renderTopbar = () => (
    <header className="topbar">
      <div className="topbar-links">
        <span className="topbar-link is-active">Network Status</span>
        <span className="topbar-link">Governance</span>
        <span className="topbar-link">Rules</span>
      </div>
      <div className="topbar-actions">
        <button className="topbar-notification">
          🔔
          <span className="notif-dot" />
        </button>
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
        <div className="topbar-avatar" title={walletAddr || "Guest"}>
          {walletAddr ? walletAddr.slice(2, 4).toUpperCase() : "?"}
        </div>
      </div>
    </header>
  );

  /* ================================================================ */
  /*  Case Queue Page                                                  */
  /* ================================================================ */

  const renderCaseQueue = () => (
    <div className="dashboard-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Active Case Queue</h1>
          <p>Manage and track all dispute cases across the AccordMesh protocol</p>
        </div>
        <button className="btn btn-outline-accent btn-sm" onClick={() => {
          const csv = ["Case ID,Title,Type,Stage,Staked (GEN)",
            ...disputes.map(d => `${d.id},"${d.title}",${d.caseType},${d.stage},${weiToGen(d.escrow.totalEscrowWei)}`)
          ].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = "accordmesh-cases.csv"; a.click();
          URL.revokeObjectURL(url);
        }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Search / Filter Bar */}
      <div className="filter-bar">
        <div className="filter-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search cases by ID, title, or type…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        <div className="filter-tags">
          {Object.keys(STAGE_FILTER_MAP).map((filter) => (
            <button
              key={filter}
              className={`filter-tag ${activeFilter === filter ? "is-active" : ""}`}
              onClick={() => { setActiveFilter(filter); setPage(1); }}
            >
              {filter}
            </button>
          ))}
        </div>
        <button className="filter-advanced">⚙ Advanced</button>
      </div>

      {/* Case Table */}
      <div className="table-panel">
        <div className="case-table-wrap">
          <table className="case-table">
            <thead>
              <tr>
                <th>CASE ID</th>
                <th>TITLE & DETAILS</th>
                <th>TYPE</th>
                <th>STAGE</th>
                <th>STAKED (GEN)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDisputes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="case-table-empty">
                    {loading ? "Loading cases…" : "No disputes match your filters. File a new case to get started."}
                  </td>
                </tr>
              ) : (
                paginatedDisputes.map((d) => (
                  <tr
                    key={d.id}
                    className={d.id === selectedCaseId ? "is-selected" : ""}
                    onClick={() => setSelectedCaseId(d.id)}
                  >
                    <td><span className="case-id">#{d.id.slice(0, 8)}</span></td>
                    <td>
                      <strong>{d.title || "Untitled"}</strong>
                      <p>{d.claimantStatement ? d.claimantStatement.slice(0, 80) + (d.claimantStatement.length > 80 ? "…" : "") : "No statement"}</p>
                    </td>
                    <td><span className="case-type-badge">{d.caseType || "—"}</span></td>
                    <td><span className={`stage-badge ${d.stage.toLowerCase().replace(/_/g, "-")}`}>{STAGE_LABELS[d.stage]}</span></td>
                    <td><span className="staked-value">{weiToGen(d.escrow.totalEscrowWei)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredDisputes.length > 0 && (
          <div className="pagination-bar">
            <span className="pagination-info">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredDisputes.length)} of {filteredDisputes.length} cases
            </span>
            <div className="pagination-controls">
              <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`pagination-btn ${page === i + 1 ? "is-active" : ""}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* Workflow Stepper */}
      {renderWorkflow()}
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
            <p className="text-muted">Select a case from the queue above to view its workflow progress.</p>
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
      case 0:
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

      case 1:
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

      case 2:
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 3: Submit Response</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>The respondent provides their statement and evidence URLs.</p>
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

      case 3:
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
              <span className="text-muted">On-chain AI analysis via gl.nondet.web.render</span>
              <button className="btn btn-accent" onClick={handleAnalyzeCase} disabled={txStatus.phase === "pending"}>
                Run Analysis
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 5: Adjudicate</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>Leader-validator consensus produces a verdict.</p>
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

      case 5:
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 6: Mediation</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>Parties choose from settlement options (A/B/C) or reject.</p>
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
            {Object.keys(selectedCase.mediationPositions).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <span className="detail-label">Recorded Positions</span>
                <div style={{ marginTop: 8 }}>
                  {Object.entries(selectedCase.mediationPositions).map(([addr, pos]) => (
                    <div key={addr} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
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

      case 6:
        return (
          <div>
            <h3 style={{ color: "var(--text)", margin: "0 0 8px" }}>Step 7: Final Terms</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>Operator resolves the dispute, escrow is settled, penalty/reward distributed.</p>
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
                    <span className="input-hint">{loserPenaltyBps / 100}% of loser&apos;s stake goes to winner</span>
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
  /*  File Dispute Modal / Overlay                                     */
  /* ================================================================ */

  const renderFileDisputeOverlay = () => {
    if (!showFileDispute) return null;
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center",
        backdropFilter: "blur(4px)"
      }} onClick={() => setShowFileDispute(false)}>
        <div className="workflow-panel" style={{ width: "90%", maxWidth: 640, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
          <div className="workflow-panel-head">
            <h2>File a New Dispute</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowFileDispute(false)}>✕</button>
          </div>
          <div className="step-content">
            <div className="form-grid">
              <div className="form-row">
                <div className="form-field">
                  <label>Case Type</label>
                  <input type="text" value={newDispute.caseType} onChange={(e) => setNewDispute({ ...newDispute, caseType: e.target.value })} placeholder="e.g., Contract Breach" />
                </div>
                <div className="form-field">
                  <label>Stake Amount (GEN)</label>
                  <input type="text" value={newDispute.stakeAmountGen} onChange={(e) => setNewDispute({ ...newDispute, stakeAmountGen: e.target.value })} placeholder="0.1" className="mono-input" />
                </div>
              </div>
              <div className="form-field">
                <label>Case Title</label>
                <input type="text" value={newDispute.title} onChange={(e) => setNewDispute({ ...newDispute, title: e.target.value })} placeholder="Brief description of the dispute" />
              </div>
              <div className="form-field">
                <label>Respondent Address</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={newDispute.respondent} onChange={(e) => setNewDispute({ ...newDispute, respondent: e.target.value })} placeholder="0x…" className="mono-input" style={{ flex: 1 }} />
                  {walletAddr && (
                    <button type="button" className="filter-tag" style={{ whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => setNewDispute({ ...newDispute, respondent: walletAddr })}>
                      Use my wallet
                    </button>
                  )}
                </div>
                <small style={{ color: "#73777c" }}>Use "Use my wallet" to test the full workflow as both parties.</small>
              </div>
              <div className="form-field">
                <label>Claimant Statement</label>
                <textarea value={newDispute.claimantStatement} onChange={(e) => setNewDispute({ ...newDispute, claimantStatement: e.target.value })} placeholder="Describe your claim in detail…" />
              </div>
              <div className="form-field">
                <label>Evidence URLs (comma-separated)</label>
                <input type="text" value={newDispute.evidenceUrls} onChange={(e) => setNewDispute({ ...newDispute, evidenceUrls: e.target.value })} placeholder="https://example.com/evidence1.pdf" className="mono-input" />
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
                <button
                  className="btn btn-primary"
                  onClick={() => { handleFileDispute(); }}
                  disabled={txStatus.phase === "pending" || !walletAddr || !newDispute.title || !newDispute.respondent}
                >
                  {txStatus.phase === "pending" ? "Filing…" : "File Dispute & Stake"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="dashboard-frame">
      {renderSidebar()}
      <div className="dashboard-main">
        {renderTopbar()}
        {renderCaseQueue()}
      </div>
      {renderFileDisputeOverlay()}
    </div>
  );
}
