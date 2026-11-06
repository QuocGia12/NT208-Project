export {};

declare global {
  type RuntimeConfig = {
    apiBaseUrl: string;
    gameSocketUrl: string;
  };

  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}
