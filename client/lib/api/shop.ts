import type {
  AdminShopUploadResponse,
  AdminShopItemResponse,
  AdminShopItemsResponse,
  ApplyShopItemResponse,
  BuyCardResponse,
  BuyShopItemResponse,
  ShopCardsResponse,
  ShopItemsResponse,
  UpsertAdminShopItemPayload
} from '@/lib/types/shop';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const authHeaders = (token: string): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
});

const parseErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Ignore malformed payloads.
  }

  return 'Request failed. Please try again.';
};

const requestJson = async <T>(
  token: string,
  path: string,
  options: Omit<RequestInit, 'headers'> = {}
) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
};

export const fetchShopItems = async (token: string): Promise<ShopItemsResponse> =>
  requestJson<ShopItemsResponse>(token, '/api/shop/items', { method: 'GET' });

export const fetchShopCards = async (token: string): Promise<ShopCardsResponse> =>
  requestJson<ShopCardsResponse>(token, '/api/shop/cards', { method: 'GET' });

export const buyShopItem = async (
  token: string,
  itemId: string
): Promise<BuyShopItemResponse> =>
  requestJson<BuyShopItemResponse>(token, '/api/shop/buy', {
    method: 'POST',
    body: JSON.stringify({ itemId })
  });

export const applyShopItem = async (
  token: string,
  itemId: string
): Promise<ApplyShopItemResponse> =>
  requestJson<ApplyShopItemResponse>(token, '/api/shop/apply', {
    method: 'POST',
    body: JSON.stringify({ itemId })
  });

export const buyShopCard = async (
  token: string,
  cardId: string
): Promise<BuyCardResponse> =>
  requestJson<BuyCardResponse>(token, '/api/shop/buy', {
    method: 'POST',
    body: JSON.stringify({ cardId })
  });

export const fetchAdminShopItems = async (token: string): Promise<AdminShopItemsResponse> =>
  requestJson<AdminShopItemsResponse>(token, '/api/admin/shop/items', { method: 'GET' });

export const createAdminShopItem = async (
  token: string,
  payload: UpsertAdminShopItemPayload
): Promise<AdminShopItemResponse> =>
  requestJson<AdminShopItemResponse>(token, '/api/admin/shop/items', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const uploadAdminShopImage = async (
  token: string,
  payload: {
    fileName: string;
    dataUrl: string;
  }
): Promise<AdminShopUploadResponse> =>
  requestJson<AdminShopUploadResponse>(token, '/api/admin/shop/upload', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const updateAdminShopItem = async (
  token: string,
  itemId: string,
  payload: Partial<UpsertAdminShopItemPayload>
): Promise<AdminShopItemResponse> =>
  requestJson<AdminShopItemResponse>(token, `/api/admin/shop/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

export const toggleAdminShopItemActive = async (
  token: string,
  itemId: string,
  isActive?: boolean
): Promise<AdminShopItemResponse> =>
  requestJson<AdminShopItemResponse>(token, `/api/admin/shop/items/${itemId}/toggle-active`, {
    method: 'PATCH',
    body: JSON.stringify(isActive === undefined ? {} : { isActive })
  });

export const deleteAdminShopItem = async (token: string, itemId: string) =>
  requestJson<{ message: string }>(token, `/api/admin/shop/items/${itemId}`, {
    method: 'DELETE'
  });
