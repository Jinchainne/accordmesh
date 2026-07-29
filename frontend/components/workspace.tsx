"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { appConfig } from "../lib/genlayer/config";
import { createWriteClient } from "../lib/genlayer/client";
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
  const { address: connectedAddress, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
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
    { label: "Snaps API", value: "Checking..." },
    { label: "GenLayer Snap", value: "Checking..." },
  ]);
  const [transaction, setTransaction] = useState<TransactionState>(idleTransaction);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [lastPreparedAddress, setLastPreparedAddress] = useState("");

  const selectedDispute = disputes.find((item) => item.id === selectedCaseId) ?? disputes[0] ?? null;
  const resolvedCount = disputes.filter((item) => item.stage === "RESOLVED").length;
  const appealCount = disputes.reduce((sum, item) => sum + item.appeals.length, 0);
  const intakeCount = disputes.filter((item) => item.stage === "RESPONSE_PENDING").length;
  const reviewCount = disputes.filter(
    (item) => item.stage === "ANALYSIS_READY" || item.stage === "MEDIATION_OPEN",
  ).length;

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

  useEffect(() => {
    if (!connectedAddress) {
      setWalletAddress("");
      setLastPreparedAddress("");
      return;
    }

    setWalletAddress(connectedAddress);
  }, [connectedAddress]);

  const inspectWallet = useEffectEvent(async () => {
    const provider = getBrowserProvider();
    if (!provider) {
      setWalletDiagnostics([
        { label: "Provider", value: "Not found", tone: "danger" },
        { label: "MetaMask", value: "Unavailable", tone: "danger" },
        { label: "Snaps API", value: "Unavailable", tone: "danger" },
        { label: "GenLayer Snap", value: "Unknown", tone: "warn" },
      ]);
      return;
    }

    const nextDiagnostics: Array<{
      label: string;
      value: string;
      tone?: "default" | "ok" | "warn" | "danger";
    }> = [
      { label: "Provider", value: "Injected", tone: "ok" },
      { label: "MetaMask", value: provider.isMetaMask ? "Yes" : "No", tone: provider.isMetaMask ? "ok" : "warn" },
      { label: "Snaps API", value: "Checking..." },
      { label: "GenLayer Snap", value: "Checking..." },
    ];

    try {
      const clientVersion = (await provider.request({ method: "web3_clientVersion" })) as string;
      nextDiagnostics.push({
        label: "Client",
        value: clientVersion || "Unknown",
        tone: "default",
      });
    } catch {
      nextDiagnostics.push({
        label: "Client",
        value: "Unavailable",
        tone: "warn",
      });
    }

    try {
      const snaps = (await provider.request({ method: "wallet_getSnaps" })) as Record<
        string,
        { id?: string; version?: string }
      >;
      const snapEntries = Object.values(snaps ?? {});
      const genlayerSnap = snapEntries.find((snap) => snap.id?.includes("genlayer"));

      nextDiagnostics[2] = {
        label: "Snaps API",
        value: "Available",
        tone: "ok",
      };
      nextDiagnostics[3] = genlayerSnap
        ? {
            label: "GenLayer Snap",
            value: `${genlayerSnap.id}${genlayerSnap.version ? ` @ ${genlayerSnap.version}` : ""}`,
            tone: "ok",
          }
        : {
            label: "GenLayer Snap",
            value: "Not installed",
            tone: "warn",
          };
    } catch (error) {
      nextDiagnostics[2] = {
        label: "Snaps API",
        value: "Not available",
        tone: "danger",
      };
      nextDiagnostics[3] = {
        label: "GenLayer Snap",
        value: error instanceof Error ? error.message : "Could not inspect snaps",
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
      const nextChainId = (await provider.request({ method: "eth_chainId" })) as string;
      setChainId(nextChainId ?? "");
      setWalletMessage("Wallet connected. Preparing GenLayer Studionet access...");

      try {
        const writeClient = createWriteClient(address as `0x${string}`, provider);
        await writeClient.connect(appConfig.networkName as never);
        const updatedChainId = (await provider.request({ method: "eth_chainId" })) as string;
        setChainId(updatedChainId ?? nextChainId ?? "");
        setWalletMessage(
          `Connected as ${address}. Studionet access is ready${
            updatedChainId ? ` on chain ${updatedChainId}` : ""
          }.`,
        );
        await inspectWallet();
        setLastPreparedAddress(address);
      } catch (networkError) {
        const message =
          networkError instanceof Error
            ? networkError.message
            : "Wallet connected, but GenLayer network setup failed.";
        setWalletMessage(
          `${message} Use desktop MetaMask with Snaps enabled to complete Studionet setup.`,
        );
        setWalletDiagnostics((current) => [
          ...current.filter((item) => item.label !== "Connect step"),
          {
            label: "Connect step",
            value: message,
            tone: "danger",
          },
        ]);
      }
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

  useEffect(() => {
    if (!isConnected || !connectedAddress || lastPreparedAddress === connectedAddress) {
      return;
    }

    startTransition(async () => {
      await prepareConnectedWallet(connectedAddress);
    });
  }, [connectedAddress, isConnected, lastPreparedAddress, prepareConnectedWallet]);

  async function connectWallet() {
    if (!isConnected) {
      if (openConnectModal) {
        setWalletMessage("Choose a wallet in the connect modal.");
        openConnectModal();
        return;
      }

      setWalletMessage("Connect modal is unavailable. Reload and try again.");
      return;
    }

    if (connectedAddress) {
      await prepareConnectedWallet(connectedAddress);
      return;
    }

    disconnect();
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
            isConnected={isConnected && walletAddress !== ""}
            isBusy={isPending}
            mode={appConfig.mode}
            networkName={appConfig.networkName}
            rpcUrl={appConfig.rpcUrl}
            message={walletMessage}
            canConnect={Boolean(openConnectModal) || Boolean(getBrowserProvider())}
            connectLabel={isConnected ? "Prepare Studionet" : "Connect wallet"}
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
