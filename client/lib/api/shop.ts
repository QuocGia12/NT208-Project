import type { BuyCardResponse, ShopCardsResponse } from '@/lib/types/shop';

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

export const fetchShopCards = async (token: string): Promise<ShopCardsResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/shop/cards`, {
    method: 'GET',
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as ShopCardsResponse;
};

export const buyShopCard = async (
  token: string,
  cardId: string
): Promise<BuyCardResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/shop/buy`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ cardId })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as BuyCardResponse;
};
