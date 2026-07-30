export type EthereumProvider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    okxwallet?: {
      ethereum?: EthereumProvider;
    };
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

export const ACCORDMESH_PROVIDER_EVENT = "accordmesh:providersChanged";

const discoveredProviders = new Map<string, Eip6963ProviderDetail>();
let discoveryInitialized = false;
let requestProvidersTimeout: number | null = null;
let preferredProvider: EthereumProvider | null = null;

function getProviderKey(detail: Eip6963ProviderDetail) {
  return detail.info.rdns || detail.info.uuid || detail.info.name || "unknown";
}

function isMetaMaskDetail(detail: Eip6963ProviderDetail) {
  const rdns = detail.info.rdns?.toLowerCase() ?? "";
  const name = detail.info.name?.toLowerCase() ?? "";
  return rdns.includes("metamask") || name.includes("metamask");
}

function isOkxDetail(detail: Eip6963ProviderDetail) {
  const rdns = detail.info.rdns?.toLowerCase() ?? "";
  const name = detail.info.name?.toLowerCase() ?? "";
  return rdns.includes("okx") || name.includes("okx");
}

function isOkxProvider(provider: EthereumProvider) {
  return Boolean(provider.isOkxWallet || provider.isOKExWallet);
}

function isMetaMaskProvider(provider: EthereumProvider) {
  return Boolean(provider.isMetaMask && !provider.isRabby);
}

function requestEip6963Providers() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function registerDiscoveredProvider(detail: Eip6963ProviderDetail) {
  discoveredProviders.set(getProviderKey(detail), detail);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACCORDMESH_PROVIDER_EVENT));
  }
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

  requestEip6963Providers();

  // Some injected wallets announce after the app has already mounted in production,
  // so we re-request once more shortly after load to catch late providers.
  requestProvidersTimeout = window.setTimeout(() => {
    requestEip6963Providers();
  }, 1200);

  window.addEventListener("focus", requestEip6963Providers);
}

function getAllProviders() {
  const injected = window.ethereum ?? null;
  const okxInjected = window.okxwallet?.ethereum ?? null;
  const directProviders =
    injected && Array.isArray(injected.providers) && injected.providers.length
      ? injected.providers
      : injected
        ? [injected]
        : [];
  const okxProviders = okxInjected ? [okxInjected] : [];

  const announcedProviders = Array.from(discoveredProviders.values()).map((detail) => detail.provider);
  const uniqueProviders = new Set<EthereumProvider>();

  for (const provider of directProviders) {
    uniqueProviders.add(provider);
  }

  for (const provider of okxProviders) {
    uniqueProviders.add(provider);
  }

  for (const provider of announcedProviders) {
    uniqueProviders.add(provider);
  }

  return Array.from(uniqueProviders);
}

function getRankedProviders(providers: EthereumProvider[]) {
  return [...providers].sort((left, right) => getProviderScore(right) - getProviderScore(left));
}

function getProviderLabel(provider: EthereumProvider) {
  if (provider.isRabby) {
    return "Rabby";
  }

  if (isOkxProvider(provider)) {
    return "OKX Wallet";
  }

  if (provider.isMetaMask) {
    return "MetaMask";
  }

  return "Injected";
}

function getProviderScore(provider: EthereumProvider) {
  if (provider.isMetaMask && !provider.isRabby) {
    return 400;
  }

  if (isOkxProvider(provider)) {
    return 300;
  }

  if (provider.isMetaMask) {
    return 200;
  }

  if (provider.isRabby) {
    return 100;
  }

  return 0;
}

function pickPreferredProvider(providers: EthereumProvider[]) {
  if (!providers.length) {
    preferredProvider = null;
    return null;
  }

  if (preferredProvider && providers.includes(preferredProvider)) {
    return preferredProvider;
  }

  const rankedProviders = getRankedProviders(providers);
  preferredProvider = rankedProviders[0] ?? null;
  return preferredProvider;
}

export function getBrowserProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  primeBrowserProviders();

  const providers = getAllProviders();
  if (!providers.length) {
    preferredProvider = null;
    return null;
  }

  return pickPreferredProvider(providers);
}

export function getBrowserProviders() {
  if (typeof window === "undefined") {
    return [];
  }

  primeBrowserProviders();

  const providers = getAllProviders();
  if (!providers.length) {
    preferredProvider = null;
    return [];
  }

  const rankedProviders = getRankedProviders(providers);
  if (preferredProvider && rankedProviders.includes(preferredProvider)) {
    return [preferredProvider, ...rankedProviders.filter((provider) => provider !== preferredProvider)];
  }

  preferredProvider = rankedProviders[0] ?? null;
  return rankedProviders;
}

export async function waitForBrowserProviders(retries = 3, delayMs = 350) {
  if (typeof window === "undefined") {
    return [];
  }

  primeBrowserProviders();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const providers = getBrowserProviders();
    if (providers.length) {
      return providers;
    }

    requestEip6963Providers();

    if (attempt < retries) {
      await sleep(delayMs);
    }
  }

  return getBrowserProviders();
}

export function rememberBrowserProvider(provider: EthereumProvider) {
  preferredProvider = provider;
}

export function getDetectedWalletLabels() {
  if (typeof window === "undefined") {
    return [];
  }

  primeBrowserProviders();

  const labels = new Set<string>();
  for (const provider of getAllProviders()) {
    labels.add(getProviderLabel(provider));
  }

  for (const detail of discoveredProviders.values()) {
    const name = detail.info.name?.trim();
    const rdns = detail.info.rdns?.toLowerCase() ?? "";
    if (name) {
      labels.add(name);
      continue;
    }

    if (rdns.includes("metamask")) {
      labels.add("MetaMask");
      continue;
    }

    if (rdns.includes("rabby")) {
      labels.add("Rabby");
      continue;
    }

    if (rdns.includes("okx")) {
      labels.add("OKX Wallet");
    }
  }

  return Array.from(labels);
}

export function hasDedicatedMetaMaskProvider() {
  if (typeof window === "undefined") {
    return false;
  }

  primeBrowserProviders();

  return Boolean(
    Array.from(discoveredProviders.values()).find((detail) => isMetaMaskDetail(detail) && !detail.provider.isRabby) ||
      getAllProviders().find((provider) => isMetaMaskProvider(provider)),
  );
}

export function getMetaMaskProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  primeBrowserProviders();

  const discovered = Array.from(discoveredProviders.values()).find(
    (detail) => isMetaMaskDetail(detail) && !detail.provider.isRabby,
  );
  if (discovered?.provider) {
    return discovered.provider;
  }

  return getAllProviders().find((provider) => isMetaMaskProvider(provider)) ?? null;
}

export function hasOkxProvider() {
  if (typeof window === "undefined") {
    return false;
  }

  primeBrowserProviders();

  return Boolean(
    Array.from(discoveredProviders.values()).find((detail) => isOkxDetail(detail)) ||
      getAllProviders().find((provider) => isOkxProvider(provider)),
  );
}

export function getOkxProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  primeBrowserProviders();

  const discovered = Array.from(discoveredProviders.values()).find((detail) => isOkxDetail(detail));
  if (discovered?.provider) {
    return discovered.provider;
  }

  return getAllProviders().find((provider) => isOkxProvider(provider)) ?? null;
}
