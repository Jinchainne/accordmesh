export type EthereumProvider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function getBrowserProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  const injected = window.ethereum ?? null;
  if (!injected) {
    return null;
  }

  if (Array.isArray(injected.providers) && injected.providers.length) {
    return (
      injected.providers.find((provider) => provider.isMetaMask && !provider.isRabby) ??
      injected.providers.find((provider) => provider.isMetaMask) ??
      injected.providers[0] ??
      injected
    );
  }

  return injected;
}
