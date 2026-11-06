const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: 'http://localhost:4000',
  gameSocketUrl: 'http://localhost:3001'
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export const getRuntimeConfig = (): RuntimeConfig => {
  if (typeof window === 'undefined' || !window.__RUNTIME_CONFIG__) {
    return DEFAULT_RUNTIME_CONFIG;
  }

  return {
    apiBaseUrl: normalizeBaseUrl(window.__RUNTIME_CONFIG__.apiBaseUrl),
    gameSocketUrl: normalizeBaseUrl(window.__RUNTIME_CONFIG__.gameSocketUrl)
  };
};

export const getApiBaseUrl = () => getRuntimeConfig().apiBaseUrl;
export const getGameSocketUrl = () => getRuntimeConfig().gameSocketUrl;
