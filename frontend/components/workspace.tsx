"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { appConfig } from "../lib/genlayer/config";
import {
  ACCORDMESH_PROVIDER_EVENT,
  getBrowserProvider,
  getDetectedWalletLabels,
  hasDedicatedMetaMaskProvider,
} from "../lib/genlayer/wallet";
import { studionetChain } from "../lib/wallet/studionet-chain";
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
  loadWorkspaceSnapshot,
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
  const [walletMessage, setWalletMessage] = useState("");
  const [walletDiagnostics, setWalletDiagnostics] = useState<
    Array<{ label: string; value: string; tone?: "default" | "ok" | "warn" | "danger" }>
  >([
    { label: "Provider", value: "Checking..." },
    { label: "MetaMask", value: "Checking..." },
    { label: "Chain", value: "Checking..." },
    { label: "Studionet", value: "Checking..." },
  ]);
  const [transaction, setTransaction] = useState<TransactionState>(idleTransaction);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedDispute = disputes.find((item) => item.id === selectedCaseId) ?? disputes[0] ?? null;
  const hasConnectedWallet = walletAddress !== "";
  const resolvedCount = disputes.filter((item) => item.stage === "RESOLVED").length;
  const appealCount = disputes.reduce((sum, item) => sum + item.appeals.length, 0);
  const intakeCount = disputes.filter((item) => item.stage === "RESPONSE_PENDING").length;
  const reviewCount = disputes.filter(
    (item) => item.stage === "ANALYSIS_READY" || item.stage === "MEDIATION_OPEN",
  ).length;

  async function loadData() {
    const snapshot = await loadWorkspaceSnapshot();
    setDisputes(snapshot.disputes);
    setPlatformConfig(snapshot.platformConfig);
    setSelectedCaseId((current) =>
      current && snapshot.disputes.some((item) => item.id === current)
        ? current
        : (snapshot.disputes[0]?.id ?? ""),
    );

    if (snapshot.warnings.length) {
      setErrorMessage(snapshot.warnings.join(" "));
    }
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

  const inspectWallet = useEffectEvent(async () => {
    const provider = getBrowserProvider();
    if (!provider) {
      setWalletDiagnostics([
        { label: "Provider", value: "Not found", tone: "danger" },
        { label: "MetaMask", value: "Unavailable", tone: "danger" },
        { label: "Chain", value: "Unavailable", tone: "danger" },
        { label: "Studionet", value: "Unknown", tone: "warn" },
      ]);
      return;
    }

    const nextDiagnostics: Array<{
      label: string;
      value: string;
      tone?: "default" | "ok" | "warn" | "danger";
    }> = [
      { label: "Provider", value: "Injected", tone: "ok" },
      {
        label: "MetaMask",
        value: provider.isMetaMask ? (provider.isRabby ? "Spoofed by Rabby" : "Yes") : "No",
        tone: provider.isMetaMask ? (provider.isRabby ? "warn" : "ok") : "warn",
      },
      { label: "Chain", value: "Checking..." },
      { label: "Studionet", value: "Checking..." },
    ];

    try {
      const clientVersion = (await provider.request({ method: "web3_clientVersion" })) as string;
      nextDiagnostics.push({
        label: "Client",
        value: clientVersion || "Unknown",
        tone: "default",
      });

      if (clientVersion?.toLowerCase().includes("rabby") || provider.isRabby) {
        nextDiagnostics.push({
          label: "Compatibility",
          value: "Rabby can inject as MetaMask. MetaMask is recommended for the cleanest Studionet flow.",
          tone: "warn",
        });
      }
    } catch {
      nextDiagnostics.push({
        label: "Client",
        value: "Unavailable",
        tone: "warn",
      });
    }

    const detectedWallets = getDetectedWalletLabels();
    if (detectedWallets.length) {
      nextDiagnostics.push({
        label: "Detected wallets",
        value: detectedWallets.join(", "),
        tone: detectedWallets.some((item) => item.toLowerCase().includes("metamask")) ? "ok" : "warn",
      });
    }

    if (provider.isRabby && !hasDedicatedMetaMaskProvider()) {
      nextDiagnostics.push({
        label: "Recommendation",
        value: "Only Rabby is active for this site. Disable Rabby here or open a MetaMask-only browser profile.",
        tone: "warn",
      });
    }

    try {
      const currentChainId = (await provider.request({ method: "eth_chainId" })) as string;
      nextDiagnostics[2] = {
        label: "Chain",
        value: currentChainId || "Unknown",
        tone: "ok",
      };
      nextDiagnostics[3] = {
        label: "Studionet",
        value: currentChainId === "0xf22f" ? "Ready" : "Needs switch",
        tone: currentChainId === "0xf22f" ? "ok" : "warn",
      };
    } catch (error) {
      nextDiagnostics[2] = {
        label: "Chain",
        value: "Not available",
        tone: "danger",
      };
      nextDiagnostics[3] = {
        label: "Studionet",
        value: error instanceof Error ? error.message : "Could not inspect chain state",
        tone: "warn",
      };
    }

    setWalletDiagnostics(nextDiagnostics);
  });

  const syncWalletState = useEffectEvent(async () => {
    const provider = getBrowserProvider();
    if (!provider) {
      setWalletMessage("No injected browser wallet was found in this browser.");
      await inspectWallet();
      return;
    }

    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    const nextChainId = (await provider.request({ method: "eth_chainId" })) as string;
    setWalletAddress(accounts[0] ?? "");
    setChainId(nextChainId ?? "");
    setWalletMessage(
      accounts[0]
        ? "Wallet connected and ready to sign GenLayer transactions."
        : "Wallet detected. Connect MetaMask to sign transactions.",
    );
    await inspectWallet();
  });

  useEffect(() => {
    const provider = getBrowserProvider();
    void syncWalletState();

    const handleProviderInventoryChanged = () => {
      void syncWalletState();
    };

    window.addEventListener(ACCORDMESH_PROVIDER_EVENT, handleProviderInventoryChanged);

    if (!provider) {
      return () => {
        window.removeEventListener(ACCORDMESH_PROVIDER_EVENT, handleProviderInventoryChanged);
      };
    }

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
      window.removeEventListener(ACCORDMESH_PROVIDER_EVENT, handleProviderInventoryChanged);
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [syncWalletState]);

  const ensureStudionet = useEffectEvent(async () => {
    const provider = getBrowserProvider();
    if (!provider) {
      throw new Error("No browser wallet detected.");
    }

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xf22f" }],
      });
    } catch (error) {
      const switchError = error as { code?: number; message?: string };

      if (switchError?.code !== 4902) {
        throw error;
      }

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xf22f",
            chainName: studionetChain.name,
            nativeCurrency: studionetChain.nativeCurrency,
            rpcUrls: studionetChain.rpcUrls.default.http,
            blockExplorerUrls: [studionetChain.blockExplorers.default.url],
          },
        ],
      });
    }
  });

  const prepareConnectedWallet = useEffectEvent(async (address: string) => {
    const provider = getBrowserProvider();
    if (!provider) {
      setErrorMessage("No browser wallet detected.");
      setWalletMessage("No injected browser wallet was found. Open the app in a browser with MetaMask.");
      return;
    }

    try {
      setErrorMessage("");
      await inspectWallet();
      setWalletMessage("Wallet connected. Preparing Studionet network...");

      await ensureStudionet();

      const updatedChainId = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(updatedChainId ?? "");
      setWalletAddress(address);
      setWalletMessage(
        `Connected as ${address}. Studionet access is ready${
          updatedChainId ? ` on chain ${updatedChainId}` : ""
        }.`,
      );
      await inspectWallet();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet connection failed.";
      setErrorMessage(message);
      setWalletMessage(message);
      setWalletDiagnostics((current) => [
        ...current.filter((item) => item.label !== "Connect step"),
        {
          label: "Connect step",
          value: message,
          tone: "danger",
        },
      ]);
    }
  });

  async function connectWallet() {
    const provider = getBrowserProvider();
    if (!provider) {
      setWalletMessage("No injected browser wallet was found. Install MetaMask or reopen this page in your wallet browser.");
      await inspectWallet();
      return;
    }

    try {
      setWalletMessage("Requesting wallet access...");
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const nextAddress = accounts[0] ?? "";

      if (nextAddress) {
        await prepareConnectedWallet(nextAddress);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet access request failed.";
      setWalletMessage(message);
      setWalletDiagnostics((current) => [
        ...current.filter((item) => item.label !== "Connect step"),
        {
          label: "Connect step",
          value: message,
          tone: "danger",
        },
      ]);
      return;
    }

    setWalletMessage("Wallet detected, but no account was returned.");
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
    <main className="shell shell-app">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark">A</div>
          <div>
            <span className="eyebrow solid">AccordMesh</span>
            <h1>Dispute operations workspace</h1>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-chip">
            <span>Network</span>
            <strong>{appConfig.networkName}</strong>
          </div>
          <div className="header-chip">
            <span>Mode</span>
            <strong>{appConfig.mode}</strong>
          </div>
          <a className="button" href="#intake">
            New file
          </a>
        </div>
      </header>

      {errorMessage ? (
        <section className="panel error-panel">
          <h2>Load error</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <TransactionStatusPanel transaction={transaction} />

      <section className="workspace-layout">
        <aside className="sidebar">
          <section className="panel sidebar-intro">
            <div className="section-top compact">
              <div>
                <span className="eyebrow dark">Operations</span>
                <h2>Run intake, review, appeals, and handoff from one board.</h2>
              </div>
            </div>
            <p>
              A casework console for marketplaces and operators that need evidence handling,
              specialist routing, and regulator-ready outputs.
            </p>
          </section>

          <nav className="panel section-nav">
            <a href="#overview">Overview</a>
            <a href="#board">Case board</a>
            <a href="#intake">Open new file</a>
            <a href="#detail">Case workspace</a>
          </nav>

          <WalletPanel
            address={walletAddress}
            chainId={chainId}
            hasWallet={Boolean(getBrowserProvider())}
            isConnected={hasConnectedWallet}
            isBusy={isPending}
            mode={appConfig.mode}
            networkName={appConfig.networkName}
            rpcUrl={appConfig.rpcUrl}
            message={walletMessage}
            canConnect={Boolean(getBrowserProvider())}
            connectLabel={hasConnectedWallet ? "Switch to Studionet" : "Connect wallet"}
            diagnostics={walletDiagnostics}
            onConnect={connectWallet}
            onRefresh={() => {
              startTransition(async () => {
                await refreshData();
              });
            }}
          />

          <CaseList
            disputes={disputes}
            selectedCaseId={selectedDispute?.id ?? ""}
            onSelect={setSelectedCaseId}
          />
        </aside>

        <div className="content-stack">
          <section className="overview-grid" id="overview">
            <div className="panel summary-panel summary-panel-primary">
              <div className="summary-copy">
                <span className="eyebrow solid">Live workspace</span>
                <h2>Teams get one operating surface instead of a static showcase page.</h2>
                <p>
                  Intake, neutral analysis, assigned counsel, reviewer oversight, appeals, and
                  regulator export stay inside the same procedural record.
                </p>
              </div>
              <div className="summary-actions">
                <a className="button" href="#detail">
                  Open selected file
                </a>
                <a className="button secondary" href="#intake">
                  Start intake
                </a>
              </div>
            </div>

            <div className="metric-cluster">
              <div className="metric-card dense">
                <span>Open files</span>
                <strong>{disputes.length}</strong>
                <p>All active records loaded from the current workspace state.</p>
              </div>
              <div className="metric-card dense">
                <span>Resolution-ready</span>
                <strong>{resolvedCount}</strong>
                <p>Matters already suitable for export and oversight handoff.</p>
              </div>
              <div className="metric-card dense">
                <span>Appeals</span>
                <strong>{appealCount}</strong>
                <p>Reconsideration requests and review actions tracked on board.</p>
              </div>
            </div>
          </section>

          <section className="panel board-panel" id="board">
            <div className="section-top compact">
              <div>
                <span className="eyebrow dark">Board status</span>
                <h2>Operational queue</h2>
              </div>
              <p>Use this to see what needs intake completion, review, or post-resolution handling.</p>
            </div>
            <div className="queue-grid">
              <div className="queue-card">
                <span>Intake waiting response</span>
                <strong>{intakeCount}</strong>
                <p>Filed matters still waiting on respondent participation.</p>
              </div>
              <div className="queue-card">
                <span>In review</span>
                <strong>{reviewCount}</strong>
                <p>Cases currently ready for analysis or mediation operations.</p>
              </div>
              <div className="queue-card">
                <span>Operator</span>
                <strong className="mono">{platformConfig.operator || "Unbound"}</strong>
                <p>Current operator address bound to this network deployment.</p>
              </div>
            </div>
          </section>

          <div id="intake">
            <DisputeWizard disabled={isPending} onCreate={createCase} />
          </div>

          <div id="detail">
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
        </div>
      </section>
    </main>
  );
}
