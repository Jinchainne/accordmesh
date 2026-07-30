"use client";

type WalletPanelProps = {
  address: string;
  chainId: string;
  hasWallet: boolean;
  hasMetaMask?: boolean;
  hasOkx?: boolean;
  isConnected: boolean;
  isReady: boolean;
  isBusy: boolean;
  networkName: string;
  rpcUrl: string;
  message?: string;
  canConnect: boolean;
  connectLabel: string;
  diagnostics: Array<{ label: string; value: string; tone?: "default" | "ok" | "warn" | "danger" }>;
  variant?: "full" | "compact";
  onConnect(): void;
  onConnectMetaMask?(): void;
  onConnectOkx?(): void;
  onRefresh(): void;
};

export function WalletPanel({
  address,
  chainId,
  hasWallet,
  hasMetaMask = false,
  hasOkx = false,
  isConnected,
  isReady,
  isBusy,
  networkName,
  rpcUrl,
  message,
  canConnect,
  connectLabel,
  diagnostics,
  variant = "full",
  onConnect,
  onConnectMetaMask,
  onConnectOkx,
  onRefresh,
}: WalletPanelProps) {
  const isCompact = variant === "compact";
  const compactDiagnostics = diagnostics.slice(0, 4);
  const shortAddress = isConnected ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const compactStatus = isReady ? "Ready" : isConnected ? "Switch network" : "Connect";

  return (
    <section className={`wallet-panel ${isCompact ? "wallet-panel-compact" : "panel"}`}>
      {isCompact ? (
        <>
          <div className="wallet-compact-main">
            <div className="wallet-compact-network">
              <span>Network</span>
              <strong>{networkName}</strong>
            </div>
            <div className="wallet-compact-summary">
              <strong>{isConnected ? shortAddress : "Wallet"}</strong>
              <span>{hasWallet ? compactStatus : "No wallet detected"}</span>
            </div>
            <div className="actions-row wallet-panel-actions">
              <button className="button" type="button" onClick={onConnect} disabled={isBusy || !canConnect}>
                {connectLabel}
              </button>
            </div>
            {!isConnected && (hasMetaMask || hasOkx) ? (
              <div className="wallet-provider-buttons">
                {hasMetaMask ? (
                  <button
                    className="button secondary wallet-provider-button"
                    type="button"
                    onClick={onConnectMetaMask}
                    disabled={isBusy || !canConnect}
                  >
                    MetaMask
                  </button>
                ) : null}
                {hasOkx ? (
                  <button
                    className="button secondary wallet-provider-button"
                    type="button"
                    onClick={onConnectOkx}
                    disabled={isBusy || !canConnect}
                  >
                    OKX
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="wallet-panel-feedback wallet-panel-feedback-compact">
            {message ? <p className="tiny-note">{message}</p> : <p className="tiny-note wallet-feedback-placeholder" />}
          </div>
          <details className="wallet-compact-details">
            <summary>Connection details</summary>
            <div className="wallet-compact-diagnostics">
              {compactDiagnostics.map((item) => (
                <div className={`diagnostic-row ${item.tone ?? "default"}`} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <>
          <div className={`section-top compact ${isCompact ? "wallet-panel-top" : ""}`}>
            <div>
              <span className={`eyebrow ${isCompact ? "solid" : "dark"}`}>Network access</span>
              <h2>{isCompact ? "Wallet" : "Wallet and chain"}</h2>
            </div>
          </div>
          <div className={`list ${isCompact ? "wallet-panel-grid" : ""}`}>
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
              <strong>Live Studionet workflow</strong>
            </div>
            <div className="stage-card compact-card">
              <strong>RPC endpoint</strong>
              <p className="mono">{rpcUrl}</p>
            </div>
            <div className="stage-card compact-card">
              <strong>Connected signer</strong>
              <p className="mono">{isConnected ? address : "Connect an EVM wallet to sign transactions."}</p>
              {chainId ? <p>Current chain id: {chainId}</p> : null}
              <p>Network: {networkName}</p>
            </div>
          </div>
          <div className={`actions-row tight-actions ${isCompact ? "wallet-panel-actions" : ""}`}>
            <button className="button" type="button" onClick={onConnect} disabled={isBusy || !canConnect}>
              {connectLabel}
            </button>
            <button className="button secondary" type="button" onClick={onRefresh} disabled={isBusy}>
              Refresh cases
            </button>
          </div>
          <div className="wallet-panel-feedback">
            {message ? <p className="tiny-note">{message}</p> : <p className="tiny-note wallet-feedback-placeholder" />}
          </div>
          <div className={`diagnostic-list wallet-diagnostic-list ${isCompact ? "wallet-diagnostic-list-compact" : ""}`}>
            {diagnostics.map((item) => (
              <div className={`diagnostic-row ${item.tone ?? "default"}`} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
