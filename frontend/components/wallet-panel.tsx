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
  onConnect(): void;
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
  onConnect,
  onRefresh,
}: WalletPanelProps) {
  return (
    <section className="panel">
      <div className="meta">
        <span className="badge">Wallet</span>
        <span>{mode === "mock" ? "Mock workflow" : "Live Studionet workflow"}</span>
      </div>
      <h2>Connection workspace</h2>
      <div className="list">
        <div className="stage-card">
          <strong>Network</strong>
          <p>
            {networkName} via <span className="mono">{rpcUrl}</span>
          </p>
        </div>
        <div className="stage-card">
          <strong>Wallet status</strong>
          <p>{hasWallet ? "Browser wallet detected." : "No browser wallet detected."}</p>
          <p>{isConnected ? `Connected as ${address}` : "Connect MetaMask to sign transactions."}</p>
          {chainId ? <p>Current chain id: {chainId}</p> : null}
        </div>
      </div>
      <div className="actions-row">
        <button className="button" type="button" onClick={onConnect} disabled={isBusy || !hasWallet}>
          {isConnected ? "Reconnect wallet" : "Connect wallet"}
        </button>
        <button className="button secondary" type="button" onClick={onRefresh} disabled={isBusy}>
          Refresh cases
        </button>
      </div>
    </section>
  );
}

