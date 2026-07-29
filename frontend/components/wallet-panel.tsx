"use client";

type WalletPanelProps = {
  address: string;
  chainId: string;
  hasWallet: boolean;
  isConnected: boolean;
  isBusy: boolean;
  mode: string;
  networkName: string;
  rpcUrl: string;
  message?: string;
  canConnect: boolean;
  connectLabel: string;
  showSnapAction?: boolean;
  snapActionLabel?: string;
  diagnostics: Array<{ label: string; value: string; tone?: "default" | "ok" | "warn" | "danger" }>;
  onConnect(): void;
  onInstallSnap?(): void;
  onRefresh(): void;
};

export function WalletPanel({
  address,
  chainId,
  hasWallet,
  isConnected,
  isBusy,
  mode,
  networkName,
  rpcUrl,
  message,
  canConnect,
  connectLabel,
  showSnapAction,
  snapActionLabel,
  diagnostics,
  onConnect,
  onInstallSnap,
  onRefresh,
}: WalletPanelProps) {
  return (
    <section className="panel">
      <div className="section-top compact">
        <div>
          <span className="eyebrow dark">Network access</span>
          <h2>Wallet and chain</h2>
        </div>
      </div>
      <div className="list">
        <div className="status-row">
          <span>Status</span>
          <strong>{isConnected ? "Connected" : "Not connected"}</strong>
        </div>
        <div className="status-row">
          <span>Wallet</span>
          <strong>{hasWallet ? "Detected" : "Missing"}</strong>
        </div>
        <div className="status-row">
          <span>Environment</span>
          <strong>{mode === "mock" ? "Mock workflow" : "Live Studionet workflow"}</strong>
        </div>
        <div className="stage-card compact-card">
          <strong>RPC endpoint</strong>
          <p className="mono">{rpcUrl}</p>
        </div>
        <div className="stage-card compact-card">
          <strong>Connected signer</strong>
          <p className="mono">{isConnected ? address : "Connect MetaMask to sign transactions."}</p>
          {chainId ? <p>Current chain id: {chainId}</p> : null}
          <p>Network: {networkName}</p>
        </div>
      </div>
      <div className="actions-row tight-actions">
        <button className="button" type="button" onClick={onConnect} disabled={isBusy || !canConnect}>
          {connectLabel}
        </button>
        {showSnapAction && onInstallSnap ? (
          <button className="button secondary" type="button" onClick={onInstallSnap} disabled={isBusy}>
            {snapActionLabel || "Install GenLayer Snap"}
          </button>
        ) : null}
        <button className="button secondary" type="button" onClick={onRefresh} disabled={isBusy}>
          Refresh cases
        </button>
      </div>
      {message ? <p className="tiny-note">{message}</p> : null}
      <div className="diagnostic-list">
        {diagnostics.map((item) => (
          <div className={`diagnostic-row ${item.tone ?? "default"}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
