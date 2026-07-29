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

type Eip6963ProviderInfo = {
  rdns?: string;
  name?: string;
  uuid?: string;
  icon?: string;
};

type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
};

const discoveredProviders = new Map<string, Eip6963ProviderDetail>();
let discoveryInitialized = false;

function getProviderKey(detail: Eip6963ProviderDetail) {
  return detail.info.rdns || detail.info.uuid || detail.info.name || "unknown";
}

function isMetaMaskDetail(detail: Eip6963ProviderDetail) {
  const rdns = detail.info.rdns?.toLowerCase() ?? "";
  const name = detail.info.name?.toLowerCase() ?? "";
  return rdns.includes("metamask") || name.includes("metamask");
}

function registerDiscoveredProvider(detail: Eip6963ProviderDetail) {
  discoveredProviders.set(getProviderKey(detail), detail);
}

export function primeBrowserProviders() {
  if (typeof window === "undefined" || discoveryInitialized) {
    return;
  }

  discoveryInitialized = true;

  window.addEventListener("eip6963:announceProvider", ((event: Event) => {
    const customEvent = event as CustomEvent<Eip6963ProviderDetail>;
    if (customEvent.detail?.provider) {
      registerDiscoveredProvider(customEvent.detail);
    }
  }) as EventListener);

  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function getAllProviders() {
  const injected = window.ethereum ?? null;
  if (!injected) {
    return [];
  }

  const directProviders = Array.isArray(injected.providers) && injected.providers.length
    ? injected.providers
    : [injected];

  const announcedProviders = Array.from(discoveredProviders.values()).map((detail) => detail.provider);
  const uniqueProviders = new Set<EthereumProvider>();

  for (const provider of directProviders) {
    uniqueProviders.add(provider);
  }

  for (const provider of announcedProviders) {
    uniqueProviders.add(provider);
  }

  return Array.from(uniqueProviders);
}

export function getBrowserProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  primeBrowserProviders();

  const providers = getAllProviders();
  if (!providers.length) {
    return null;
  }

  const metaMaskFromDiscovery = Array.from(discoveredProviders.values()).find(
    (detail) => isMetaMaskDetail(detail) && !detail.provider.isRabby,
  )?.provider;

  if (metaMaskFromDiscovery) {
    return metaMaskFromDiscovery;
  }

  return (
    providers.find((provider) => provider.isMetaMask && !provider.isRabby) ??
    providers.find((provider) => provider.isMetaMask) ??
    providers[0] ??
    null
  );
}
