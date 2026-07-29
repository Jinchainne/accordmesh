"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { appConfig } from "../lib/genlayer/config";
import { getBrowserProvider } from "../lib/genlayer/wallet";
import type {
  AppealReviewInput,
  AppealInput,
  AssignRoleInput,
  DisputeRecord,
  FinalTermsInput,
  MediationInput,
  NewDisputeInput,
  PlatformConfig,
  ResponseInput,
  TransactionState,
} from "../lib/domain/types";
import {
  analyzeCase,
  assignRole,
  createDispute,
  getPlatformConfig,
  listDisputes,
  publishFinalTerms,
  recordMediation,
  reviewAppeal,
  submitAppeal,
  submitResponse,
} from "../lib/services/dispute-service";
import { CaseDetail } from "./case-detail";
import { CaseList } from "./case-list";
import { DisputeWizard } from "./dispute-wizard";
import { TransactionStatusPanel } from "./transaction-status";
import { WalletPanel } from "./wallet-panel";

const idleTransaction: TransactionState = {
  phase: "idle",
  label: "",
};

export function Workspace() {
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    platformName: "AccordMesh",
    rulesUri: "",
    operator: "",
  });
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [transaction, setTransaction] = useState<TransactionState>(idleTransaction);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedDispute = disputes.find((item) => item.id === selectedCaseId) ?? disputes[0] ?? null;
  const resolvedCount = disputes.filter((item) => item.stage === "RESOLVED").length;
  const appealCount = disputes.reduce((sum, item) => sum + item.appeals.length, 0);

  async function loadData() {
    const [loadedDisputes, loadedPlatformConfig] = await Promise.all([
      listDisputes(),
      getPlatformConfig(),
    ]);
    setDisputes(loadedDisputes);
    setPlatformConfig(loadedPlatformConfig);
    setSelectedCaseId((current) =>
      current && loadedDisputes.some((item) => item.id === current)
        ? current
        : (loadedDisputes[0]?.id ?? ""),
    );
  }

  const refreshData = useEffectEvent(async () => {
    try {
      setErrorMessage("");
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load disputes.");
    }
  });

  useEffect(() => {
    startTransition(async () => {
      await refreshData();
    });
  }, [refreshData]);

  const syncWalletState = useEffectEvent(async () => {
    const provider = getBrowserProvider();
    if (!provider) {
      return;
    }

    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    const nextChainId = (await provider.request({ method: "eth_chainId" })) as string;
    setWalletAddress(accounts[0] ?? "");
    setChainId(nextChainId ?? "");
  });

  useEffect(() => {
    const provider = getBrowserProvider();
    if (!provider) {
      return;
    }

    void syncWalletState();

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccounts = Array.isArray(accounts) ? accounts.map(String) : [];
      setWalletAddress(nextAccounts[0] ?? "");
    };

    const handleChainChanged = (nextChainId: unknown) => {
      setChainId(String(nextChainId ?? ""));
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [syncWalletState]);

  async function connectWallet() {
    const provider = getBrowserProvider();
    if (!provider) {
      setErrorMessage("No browser wallet detected.");
      return;
    }

    try {
      setErrorMessage("");
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const nextChainId = (await provider.request({ method: "eth_chainId" })) as string;
      setWalletAddress(accounts[0] ?? "");
      setChainId(nextChainId ?? "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Wallet connection failed.");
    }
  }

  async function runMutation(label: string, task: () => Promise<string>) {
    setTransaction({
      phase: "pending",
      label,
      detail: "Waiting for the GenLayer transaction to be accepted.",
    });

    try {
      const hash = await task();
      setTransaction({
        phase: "success",
        label,
        hash,
        detail: "Transaction accepted. The case board was refreshed from the current network state.",
      });
      await refreshData();
    } catch (error) {
      setTransaction({
        phase: "error",
        label,
        detail: error instanceof Error ? error.message : "Transaction failed.",
      });
    }
  }

  function createCase(input: NewDisputeInput) {
    return runMutation("File dispute", () => createDispute(input, walletAddress));
  }

  function respondToCase(input: ResponseInput) {
    return runMutation("Submit response", () => submitResponse(input, walletAddress));
  }

  function analyzeSelectedCase(caseId: string) {
    return runMutation("Analyze case", () => analyzeCase(caseId, walletAddress));
  }

  function saveMediation(input: MediationInput) {
    return runMutation("Record mediation position", () => recordMediation(input, walletAddress));
  }

  function finalizeCase(input: FinalTermsInput) {
    return runMutation("Publish final terms", () => publishFinalTerms(input, walletAddress));
  }

  function assignSpecialist(input: AssignRoleInput) {
    return runMutation(`Assign ${input.role}`, () => assignRole(input, walletAddress));
  }

  function fileAppeal(input: AppealInput) {
    return runMutation("Submit appeal", () => submitAppeal(input, walletAddress));
  }

  function decideAppeal(input: AppealReviewInput) {
    return runMutation("Review appeal", () => reviewAppeal(input, walletAddress));
  }

  return (
    <main className="shell shell-wide">
      <section className="hero hero-paynest">
        <div className="hero-copy">
          <span className="eyebrow">AccordMesh on GenLayer</span>
          <h1>Dispute operations for teams that need more than a chatbot verdict.</h1>
          <p>
            A mediation-first console for platforms, operators, and marketplaces. Organize
            evidence, route specialist roles, review appeals, and generate regulator-ready case
            packets from one live workflow on GenLayer.
          </p>
          <div className="actions-row hero-actions">
            <a className="button" href="#intake">
              Open a file
            </a>
            <a className="button secondary" href="#detail">
              Review live workflow
            </a>
          </div>
          <div className="signal-strip">
            <div>
              <span>Workflow</span>
              <strong>Intake to Appeal</strong>
            </div>
            <div>
              <span>Storage</span>
              <strong>IPFS + Drive</strong>
            </div>
            <div>
              <span>Output</span>
              <strong>PDF-ready memos</strong>
            </div>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-card accent">
            <span>Live network</span>
            <strong>{appConfig.networkName}</strong>
            <p>
              {appConfig.mode === "live"
                ? "Bound to the deployed Studionet contract."
                : "Local mock workflow."}
            </p>
          </div>
          <div className="hero-card">
            <span>Resolved matters</span>
            <strong>{resolvedCount}</strong>
            <p>Files that can already be exported into an oversight-ready packet.</p>
          </div>
          <div className="hero-card">
            <span>Appeal queue</span>
            <strong>{appealCount}</strong>
            <p>Reconsideration and regulator review requests tracked in the same workspace.</p>
          </div>
        </div>
      </section>

      <section className="metric-band compact-band">
        <div className="metric-card">
          <span>Files loaded</span>
          <strong>{disputes.length}</strong>
        </div>
        <div className="metric-card">
          <span>Mode</span>
          <strong>{appConfig.mode}</strong>
        </div>
        <div className="metric-card">
          <span>Operator</span>
          <strong>{platformConfig.operator || "Unbound"}</strong>
        </div>
      </section>

      {errorMessage ? (
        <section className="panel error-panel">
          <h2>Load error</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <TransactionStatusPanel transaction={transaction} />

      <section className="grid app-grid">
        <div className="stack left-rail">
          <WalletPanel
            address={walletAddress}
            chainId={chainId}
            hasWallet={Boolean(getBrowserProvider())}
            isConnected={walletAddress !== ""}
            isBusy={isPending}
            mode={appConfig.mode}
            networkName={appConfig.networkName}
            rpcUrl={appConfig.rpcUrl}
            onConnect={connectWallet}
            onRefresh={() => {
              startTransition(async () => {
                await refreshData();
              });
            }}
          />
          <div id="intake">
            <DisputeWizard disabled={isPending} onCreate={createCase} />
          </div>
          <CaseList
            disputes={disputes}
            selectedCaseId={selectedDispute?.id ?? ""}
            onSelect={setSelectedCaseId}
          />
        </div>
        <div className="stack" id="detail">
          <section className="panel vision-panel">
            <div className="vision-grid">
              <div>
                <span className="eyebrow dark">Why it feels real</span>
                <h2>Designed like an operations console, not an AI landing page.</h2>
              </div>
              <div className="vision-list">
                <div className="vision-item">
                  Mediation first, then final terms, then a regulator-ready packet.
                </div>
                <div className="vision-item">
                  Counsel, reviewers, and regulators sit inside the same case record.
                </div>
                <div className="vision-item">
                  Appeals become part of the procedural timeline instead of a dead-end chat reset.
                </div>
              </div>
            </div>
          </section>
          <CaseDetail
            dispute={selectedDispute}
            operator={platformConfig.operator}
            connectedAddress={walletAddress}
            busy={isPending}
            onRespond={respondToCase}
            onAnalyze={analyzeSelectedCase}
            onMediation={saveMediation}
            onFinalize={finalizeCase}
            onAssignRole={assignSpecialist}
            onSubmitAppeal={fileAppeal}
            onReviewAppeal={decideAppeal}
          />
        </div>
      </section>
    </main>
  );
}
