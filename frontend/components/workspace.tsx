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
          <h1>Casework for the internet economy, from evidence intake to regulatory handoff.</h1>
          <p>
            AccordMesh is a mediation-first dispute console for platforms, creators, vendors, and
            operators. It structures evidence, runs neutral analysis, tracks specialist roles, and
            produces post-resolution packets for outside oversight.
          </p>
          <div className="actions-row">
            <a className="button" href="#intake">
              Start a new file
            </a>
            <a className="button secondary" href="#detail">
              Inspect live casework
            </a>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-card accent">
            <span>Network</span>
            <strong>{appConfig.networkName}</strong>
            <p>{appConfig.mode === "live" ? "Bound to the deployed Studionet contract." : "Local mock workflow."}</p>
          </div>
          <div className="hero-card">
            <span>Resolved matters</span>
            <strong>{resolvedCount}</strong>
            <p>Cases already eligible for regulator-ready packet export.</p>
          </div>
          <div className="hero-card">
            <span>Appeal queue</span>
            <strong>{appealCount}</strong>
            <p>Tracked oversight or reconsideration requests across the board.</p>
          </div>
        </div>
      </section>

      <section className="grid grid-top">
        <section className="panel panel-heavy">
          <div className="section-top">
            <div>
              <span className="eyebrow dark">Hackathon pitch</span>
              <h2>Why this product feels different</h2>
            </div>
            <p>
              Inspired by polished startup storytelling, but aimed at legal operations rather than
              generic AI dashboards.
            </p>
          </div>
          <div className="pitch-grid">
            <div className="pitch-card">
              <span className="mini-kicker">1</span>
              <h3>Mediation-first intelligence</h3>
              <p>It doesn&apos;t jump to a verdict. It organizes the file, spots issues, and opens realistic settlement lanes first.</p>
            </div>
            <div className="pitch-card">
              <span className="mini-kicker">2</span>
              <h3>Operational legal tooling</h3>
              <p>Specialist roles, appeal review, evidence vaults, and regulatory packets make it feel usable beyond a demo flow.</p>
            </div>
            <div className="pitch-card">
              <span className="mini-kicker">3</span>
              <h3>Live on GenLayer</h3>
              <p>Reads and writes are wired to Studionet, so the product can move from mock iteration into on-chain workflows.</p>
            </div>
          </div>
        </section>
      </section>

      <section className="metric-band">
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
