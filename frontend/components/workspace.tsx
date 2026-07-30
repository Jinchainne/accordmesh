"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { appConfig } from "../lib/genlayer/config";
import {
  ACCORDMESH_PROVIDER_EVENT,
  getActiveBrowserProvider,
  getBrowserProvider,
  getBrowserProviders,
  getDetectedWalletLabels,
  getInjectedEthereum,
  getInjectedOkxEthereum,
  getMetaMaskProvider,
  getOkxProvider,
  hasDedicatedMetaMaskProvider,
  hasOkxProvider,
  rememberBrowserProvider,
  setActiveBrowserProvider,
  waitForBrowserProviders,
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

  if (message.toLowerCase().includes("failed to fetch")) {
    return "";
  }

  return "Live sync is temporarily unavailable. You can still connect wallet and prepare case data.";
}

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
  const filteredDisputes = disputes;
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
    const provider = getActiveBrowserProvider();
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
    const provider = getActiveBrowserProvider();
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
    const provider = getActiveBrowserProvider();
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

  const ensureStudionet = useEffectEvent(async (providerOverride?: NonNullable<ReturnType<typeof getBrowserProvider>>) => {
    const provider = providerOverride ?? getActiveBrowserProvider();
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

  const prepareConnectedWallet = useEffectEvent(
    async (
      address: string,
      providerOverride?: NonNullable<ReturnType<typeof getBrowserProvider>>,
    ) => {
    const provider = providerOverride ?? getActiveBrowserProvider();
    if (!provider) {
      setErrorMessage("No browser wallet detected.");
      setWalletMessage("No injected browser wallet was found. Open the app in a browser with MetaMask, OKX Wallet, or another EVM wallet.");
      return;
    }

    try {
      setErrorMessage("");
      await inspectWallet();

      const updatedChainId = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(updatedChainId ?? "");
      setWalletAddress(address);
      setWalletMessage(
        updatedChainId === "0xf22f"
          ? `Connected as ${address}. Studionet is ready.`
          : `Connected as ${address}. Switch to Studionet to continue.`,
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
    const injectedProvider = getInjectedEthereum();
    const immediateProviders = injectedProvider ? [injectedProvider] : getBrowserProviders();
    const providers = immediateProviders.length
      ? immediateProviders
      : await waitForBrowserProviders(1, 150);
    if (!providers.length) {
      setWalletMessage("No injected browser wallet was found. Install MetaMask or OKX Wallet, or reopen this page in your wallet browser.");
      await inspectWallet();
      return;
    }

    let lastErrorMessage = "Wallet detected, but no account was returned.";

    for (const provider of providers) {
      try {
        rememberBrowserProvider(provider);
        setActiveBrowserProvider(provider);
        setWalletMessage("Requesting wallet access...");
        const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
        const nextAddress = accounts[0] ?? "";

        if (nextAddress) {
          await prepareConnectedWallet(nextAddress, provider);
          return;
        }
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : "Wallet access request failed.";
      }
    }

    const fallbackProvider = getBrowserProvider();
    if (fallbackProvider) {
      try {
        rememberBrowserProvider(fallbackProvider);
        setActiveBrowserProvider(fallbackProvider);
        const accounts = (await fallbackProvider.request({
          method: "eth_requestAccounts",
        })) as string[];
        const nextAddress = accounts[0] ?? "";

        if (nextAddress) {
          await prepareConnectedWallet(nextAddress, fallbackProvider);
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

  async function connectNamedWallet(kind: "metamask" | "okx") {
    const provider =
      kind === "metamask"
        ? getInjectedEthereum() ?? getMetaMaskProvider()
        : getInjectedOkxEthereum() ?? getOkxProvider();
    if (!provider) {
      setWalletMessage(
        kind === "metamask"
          ? "MetaMask was not detected in this browser."
          : "OKX Wallet was not detected in this browser.",
      );
      await inspectWallet();
      return;
    }

    try {
      rememberBrowserProvider(provider);
      setActiveBrowserProvider(provider);
      setWalletMessage(`Requesting ${kind === "metamask" ? "MetaMask" : "OKX Wallet"} access...`);
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const nextAddress = accounts[0] ?? "";

      if (!nextAddress) {
        throw new Error("Wallet detected, but no account was returned.");
      }

      await prepareConnectedWallet(nextAddress, provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet access request failed.";
      setErrorMessage(message);
      setWalletMessage(message);
      setWalletDiagnostics((current) => [
        ...current.filter((item) => item.label !== "Connect step"),
        {
          label: "Connect step",
          value: `${kind === "metamask" ? "MetaMask" : "OKX Wallet"}: ${message}`,
          tone: "danger",
        },
      ]);
    }
  }

  async function handleWalletAction() {
    if (!hasConnectedWallet) {
      await connectWallet();
      return;
    }

    try {
      setWalletMessage("Switching wallet to Studionet...");
      await ensureStudionet(getActiveBrowserProvider() ?? undefined);
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
    <main className="shell shell-dashboard">
      <div className="dashboard-frame">
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">A</div>
            <div>
              <strong>AccordMesh</strong>
              <span>GenLayer native</span>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Workspace sections">
            <a className="is-active" href="#overview">
              Dashboard
            </a>
            <a href="#board">My cases</a>
            <a href="#intake">Analysis</a>
            <a href="#detail">Resolutions</a>
          </nav>

          <div className="sidebar-cta">
            <a className="button sidebar-primary-button" href="#intake">
              New dispute
            </a>
          </div>

          <div className="sidebar-meta-links">
            <a href="#detail">Documentation</a>
            <a href="#board">Support</a>
          </div>
        </aside>

        <section className="dashboard-main">
          <header className="topbar">
            <div className="topbar-search">
              <span className="topbar-search-icon">o</span>
              <input aria-label="Search cases" placeholder="Search cases..." type="text" />
            </div>
            <div className="topbar-actions">
              <button className="topbar-icon" type="button" aria-label="Notifications">
                o
              </button>
              <button className="topbar-icon" type="button" aria-label="Settings">
                +
              </button>
              <WalletPanel
                address={walletAddress}
                chainId={chainId}
                hasWallet={Boolean(getActiveBrowserProvider())}
                hasMetaMask={hasDedicatedMetaMaskProvider()}
                hasOkx={hasOkxProvider()}
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
                      ? "Connected"
                      : "Switch network"
                    : "Connect Wallet"
                }
                diagnostics={walletDiagnostics}
                variant="compact"
                onConnect={handleWalletAction}
                onConnectMetaMask={() => {
                  void connectNamedWallet("metamask");
                }}
                onConnectOkx={() => {
                  void connectNamedWallet("okx");
                }}
                onRefresh={() => {
                  startTransition(async () => {
                    await refreshData();
                  });
                }}
              />
              <div className="topbar-avatar" aria-hidden="true">
                {walletAddress ? walletAddress.slice(2, 4).toUpperCase() : "GM"}
              </div>
            </div>
          </header>

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

          <div className="dashboard-content">
            <section className="system-overview panel-soft" id="overview">
              <div className="system-overview-head">
                <div>
                  <h1>System Overview</h1>
                  <p>Welcome back. Here is the current status of GenLayer dispute cases.</p>
                </div>
                <a className="button dashboard-cta-button" href="#intake">
                  New Dispute
                </a>
              </div>

              <div className="stats-grid">
                <article className="stat-card">
                  <span>Total cases</span>
                  <strong>{filteredDisputes.length}</strong>
                  <p>{selectedDispute ? "Live workspace loaded." : "Ready for intake and review."}</p>
                </article>
                <article className="stat-card">
                  <span>Active mediations</span>
                  <strong>{reviewCount}</strong>
                  <p>{reviewCount ? `${reviewCount} matters need immediate action.` : "No matters are waiting on mediation."}</p>
                </article>
                <article className="stat-card">
                  <span>Pending decisions</span>
                  <strong>{appealCount}</strong>
                  <p>{appealCount ? "Appeals are waiting on review." : "No decision queue is currently open."}</p>
                </article>
              </div>

              <section className="insight-banner">
                <div className="insight-icon">AI</div>
                <div>
                  <strong>AI Analysis: Performance Summary</strong>
                  <p>
                    {resolvedCount
                      ? `${resolvedCount} matters are already resolution-ready.`
                      : "Mediation and intake metrics will appear here once live case traffic is loaded."}
                    {" "}
                    Wallet-based signing stays available from the top bar.
                  </p>
                </div>
                <a className="button secondary" href="#detail">
                  View detailed report
                </a>
              </section>
            </section>

            <section className="content-stack">
              <CaseList
                disputes={filteredDisputes}
                selectedCaseId={selectedDispute?.id ?? ""}
                onSelect={setSelectedCaseId}
              />

              <section className="panel board-panel" id="board">
                <div className="section-top compact">
                  <div>
                    <span className="eyebrow dark">Queue</span>
                    <h2>Case board</h2>
                  </div>
                  <p>What still needs action.</p>
                </div>
                <div className="queue-grid">
                  <div className="queue-card">
                    <span>Waiting response</span>
                    <strong>{intakeCount}</strong>
                    <p>Awaiting respondent participation.</p>
                  </div>
                  <div className="queue-card">
                    <span>In review</span>
                    <strong>{reviewCount}</strong>
                    <p>Ready for analysis or mediation.</p>
                  </div>
                  <div className="queue-card">
                    <span>Operator</span>
                    <strong className="mono">{platformConfig.operator || "Unbound"}</strong>
                    <p>Bound to this deployment.</p>
                  </div>
                  <div className="queue-card">
                    <span>Selected</span>
                    <strong>{selectedDispute ? "Loaded" : "None"}</strong>
                    <p>
                      {selectedDispute
                        ? `${selectedDispute.caseType} file open below.`
                        : "Choose a case from the list above."}
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
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
