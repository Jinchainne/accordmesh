"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { appConfig } from "../lib/genlayer/config";
import {
  ACCORDMESH_PROVIDER_EVENT,
  getBrowserProvider,
  getBrowserProviders,
  getDetectedWalletLabels,
  rememberBrowserProvider,
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

function formatSyncWarning(message: string) {
  if (!message) {
    return "";
  }

  return "Live sync is temporarily unavailable. You can still connect wallet and prepare case data.";
}

export function Workspace() {
  const editionLabel = "Thursday, July 30, 2026";
  const [searchQuery, setSearchQuery] = useState("");
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
    { label: "Wallet type", value: "Checking..." },
    { label: "Chain", value: "Checking..." },
    { label: "Studionet", value: "Checking..." },
  ]);
  const [transaction, setTransaction] = useState<TransactionState>(idleTransaction);
  const [errorMessage, setErrorMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [providerRevision, setProviderRevision] = useState(0);

  const selectedDispute = disputes.find((item) => item.id === selectedCaseId) ?? disputes[0] ?? null;
  const filteredDisputes = disputes.filter((item) => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return [
      item.title,
      item.caseType,
      item.claimantStatement,
      item.respondent,
      item.claimant,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });
  const hasConnectedWallet = walletAddress !== "";
  const isStudionetReady = chainId.toLowerCase() === "0xf22f";
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

    setWarningMessage(formatSyncWarning(snapshot.warnings.join(" ")));
  }

  const refreshData = useEffectEvent(async () => {
    try {
      setErrorMessage("");
      setWarningMessage("");
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
        { label: "Preferred wallet", value: "Unavailable", tone: "danger" },
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
        label: "Wallet type",
        value: provider.isRabby
          ? "Rabby"
          : provider.isOkxWallet || provider.isOKExWallet
            ? "OKX Wallet"
            : provider.isMetaMask
              ? "MetaMask"
              : "Injected EVM wallet",
        tone: "ok",
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
          value: "Rabby detected. Use Switch to Studionet to move this wallet to chain 0xf22f.",
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
        tone: "ok",
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
        : "Wallet detected. Connect your wallet to sign transactions.",
    );
    await inspectWallet();
  });

  useEffect(() => {
    void syncWalletState();

    const handleProviderInventoryChanged = () => {
      setProviderRevision((current) => current + 1);
      void syncWalletState();
    };

    window.addEventListener(ACCORDMESH_PROVIDER_EVENT, handleProviderInventoryChanged);

    return () => {
      window.removeEventListener(ACCORDMESH_PROVIDER_EVENT, handleProviderInventoryChanged);
    };
  }, [syncWalletState]);

  useEffect(() => {
    const provider = getBrowserProvider();
    if (!provider) {
      return;
    }

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccounts = Array.isArray(accounts) ? accounts.map(String) : [];
      setWalletAddress(nextAccounts[0] ?? "");
      void syncWalletState();
    };

    const handleChainChanged = (nextChainId: unknown) => {
      setChainId(String(nextChainId ?? ""));
      void syncWalletState();
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [providerRevision, syncWalletState]);

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
      setWalletMessage("No injected browser wallet was found. Open the app in a browser with MetaMask, OKX Wallet, or another EVM wallet.");
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
    const providers = getBrowserProviders();
    if (!providers.length) {
      setWalletMessage("No injected browser wallet was found. Install MetaMask or OKX Wallet, or reopen this page in your wallet browser.");
      await inspectWallet();
      return;
    }

    let lastErrorMessage = "Wallet detected, but no account was returned.";

    for (const provider of providers) {
      try {
        rememberBrowserProvider(provider);
        setWalletMessage("Requesting wallet access...");
        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        const nextAddress = accounts[0] ?? "";

        if (nextAddress) {
          await prepareConnectedWallet(nextAddress);
          return;
        }
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : "Wallet access request failed.";
      }
    }

    setWalletMessage(lastErrorMessage);
    setWalletDiagnostics((current) => [
      ...current.filter((item) => item.label !== "Connect step"),
      {
        label: "Connect step",
        value: lastErrorMessage,
        tone: "danger",
      },
    ]);
  }

  async function handleWalletAction() {
    if (!hasConnectedWallet) {
      await connectWallet();
      return;
    }

    try {
      setWalletMessage("Switching wallet to Studionet...");
      await ensureStudionet();
      await syncWalletState();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to switch wallet network.";
      setErrorMessage(message);
      setWalletMessage(message);
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
    <main className="shell shell-app">
      <header className="app-header">
        <div className="header-strip">
          <div className="header-strip-left">
            <span className="header-kicker">Arbitration workspace</span>
            <span className="masthead-brand masthead-brand-inline">AccordMesh</span>
          </div>
          <form className="header-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <input
              aria-label="Search case files"
              placeholder="Search case title, claimant, respondent..."
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button className="button" type="submit">
              Search
            </button>
          </form>
          <div className="header-strip-right">
            <div className="header-chip">
              <span>Network</span>
              <strong>{appConfig.networkName}</strong>
            </div>
            <WalletPanel
              address={walletAddress}
              chainId={chainId}
              hasWallet={Boolean(getBrowserProvider())}
              isConnected={hasConnectedWallet}
              isReady={isStudionetReady}
              isBusy={isPending}
              networkName={appConfig.networkName}
              rpcUrl={appConfig.rpcUrl}
              message={walletMessage}
              canConnect={true}
              connectLabel={
                hasConnectedWallet
                  ? isStudionetReady
                    ? "Refresh wallet"
                    : "Switch to Studionet"
                  : "Connect wallet"
              }
              diagnostics={walletDiagnostics}
              variant="compact"
              onConnect={handleWalletAction}
              onRefresh={() => {
                startTransition(async () => {
                  await refreshData();
                });
              }}
            />
            <a className="button" href="#intake">
              New file
            </a>
          </div>
        </div>
      </header>

      <div className="header-spacer" aria-hidden="true" />

      {warningMessage ? (
        <section className="warning-banner" role="status" aria-live="polite">
          <strong>Live sync notice</strong>
          <span>{warningMessage}</span>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="panel error-panel">
          <h2>Action error</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      <TransactionStatusPanel transaction={transaction} />

      <section className="workspace-layout">
        <aside className="sidebar">
          <nav className="panel section-nav" aria-label="Workspace sections">
            <a href="#overview">Overview</a>
            <a href="#board">Case board</a>
            <a href="#intake">Open new file</a>
            <a href="#detail">Case workspace</a>
          </nav>

          <section className="panel sidebar-intro">
            <div className="section-top compact">
              <div>
                <span className="eyebrow dark">Workspace</span>
                <h2>Arbitration operations</h2>
              </div>
            </div>
            <p>
              Review open matters, start new filings, and move from intake to full dispute
              handling without leaving the board.
            </p>
          </section>

          <CaseList
            disputes={filteredDisputes}
            selectedCaseId={selectedDispute?.id ?? ""}
            onSelect={setSelectedCaseId}
          />
        </aside>

        <div className="content-stack">
          <section className="panel overview-panel" id="overview">
            <div className="section-top compact">
              <div>
                <span className="eyebrow dark">Overview</span>
                <h2>{selectedDispute?.title ?? "Dispute operations desk"}</h2>
              </div>
              <p>
                {selectedDispute?.claimantStatement ||
                  "Use this workspace to intake disputes, review evidence, manage mediation, and finalize outcomes."}
              </p>
            </div>

            <div className="metric-band compact-band">
              <div className="metric-card dense">
                <span>Open files</span>
                <strong>{filteredDisputes.length}</strong>
                <p>Disputes currently loaded in the active board.</p>
              </div>
              <div className="metric-card dense">
                <span>In review</span>
                <strong>{reviewCount}</strong>
                <p>Files ready for analysis, mediation, or assigned review.</p>
              </div>
              <div className="metric-card dense">
                <span>Appeals</span>
                <strong>{appealCount}</strong>
                <p>Review requests and escalations tracked in this workspace.</p>
              </div>
              <div className="metric-card dense">
                <span>Resolution-ready</span>
                <strong>{resolvedCount}</strong>
                <p>Files ready for export, oversight, or final handoff.</p>
              </div>
            </div>

            <div className="summary-actions">
              <a className="button" href="#detail">
                Open selected file
              </a>
              <a className="button secondary" href="#intake">
                Start intake
              </a>
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
              <div className="queue-card">
                <span>Selected file</span>
                <strong>{selectedDispute ? "Loaded" : "None"}</strong>
                <p>
                  {selectedDispute
                    ? `${selectedDispute.caseType} dispute ready in the detailed workspace.`
                    : "Choose a case from the left board to inspect record details."}
                </p>
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
