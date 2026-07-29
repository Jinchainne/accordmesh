"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { appConfig } from "../lib/genlayer/config";
import { getBrowserProvider } from "../lib/genlayer/wallet";
import type {
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
  createDispute,
  getPlatformConfig,
  listDisputes,
  publishFinalTerms,
  recordMediation,
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

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">{platformConfig.platformName}</div>
        <h1>AI-assisted dispute casework on GenLayer, built for mediation before resolution.</h1>
        <p>
          This project treats disputes like operational legal files: intake, response, issue
          mapping, settlement paths, and a final resolution memo. It can run in mock mode for UI
          development or against {appConfig.networkName} through the GenLayer Studio RPC.
        </p>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="meta">
          <span className="badge">Hackathon pitch</span>
          <span>Public-facing product summary</span>
        </div>
        <h2>Why AccordMesh stands out</h2>
        <div className="list">
          <div className="stage-card">
            <strong>Mediation-first AI workflow</strong>
            <p>
              The product does not jump straight to a verdict. It structures the record, surfaces
              issues, and gives parties realistic settlement paths before closing the file.
            </p>
          </div>
          <div className="stage-card">
            <strong>Built for real operational disputes</strong>
            <p>
              Policy packs support freelance, marketplace, lending, and B2B service conflicts with
              tailored intake prompts and evidence checklists.
            </p>
          </div>
          <div className="stage-card">
            <strong>Ready for downstream oversight</strong>
            <p>
              After resolution, the tool generates a structured regulatory packet that can be
              forwarded to a trust team, ombuds office, or regulator.
            </p>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="kpis">
          <div className="kpi">
            <strong>{disputes.length}</strong>
            <span>Cases loaded</span>
          </div>
          <div className="kpi">
            <strong>{appConfig.mode}</strong>
            <span>App mode</span>
          </div>
          <div className="kpi">
            <strong>{platformConfig.operator || "Unbound"}</strong>
            <span>Contract operator</span>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="panel error-panel">
          <h2>Load error</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <TransactionStatusPanel transaction={transaction} />

      <section className="grid">
        <div className="stack">
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
          <DisputeWizard disabled={isPending} onCreate={createCase} />
          <CaseList
            disputes={disputes}
            selectedCaseId={selectedDispute?.id ?? ""}
            onSelect={setSelectedCaseId}
          />
        </div>
        <div className="stack">
          <CaseDetail
            dispute={selectedDispute}
            operator={platformConfig.operator}
            connectedAddress={walletAddress}
            busy={isPending}
            onRespond={respondToCase}
            onAnalyze={analyzeSelectedCase}
            onMediation={saveMediation}
            onFinalize={finalizeCase}
          />
          <section className="panel">
            <div className="meta">
              <span className="badge">Operational model</span>
              <span>AccordMesh workflow</span>
            </div>
            <h2>What makes this product distinct</h2>
            <div className="list">
              <div className="stage-card">
                It is built around phased casework, not a single verdict or prediction market.
              </div>
              <div className="stage-card">
                AI generates issue maps, credibility notes, and settlement options that resemble
                practical legal operations.
              </div>
              <div className="stage-card">
                The same UI works in mock mode today and can switch to live GenLayer interactions
                by setting the contract address and connecting a wallet.
              </div>
              <div className="stage-card">
                Resolved matters can be converted into a regulator-ready dossier instead of ending
                as a dead-end app verdict.
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
