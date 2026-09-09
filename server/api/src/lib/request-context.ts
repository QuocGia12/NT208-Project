import { AsyncLocalStorage } from 'async_hooks';
export interface RequestStore {
  requestId: string;
}
export const asyncLocalStorage = new AsyncLocalStorage<RequestStore>();
export const getRequestId = (): string | undefined => {
  return asyncLocalStorage.getStore()?.requestId;
};
