export type EthereumProvider = {
  isMetaMask?: boolean;
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

  return window.ethereum ?? null;
}

