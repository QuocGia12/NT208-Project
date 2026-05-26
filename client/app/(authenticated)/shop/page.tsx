'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { buyShopCard, fetchShopCards } from '@/lib/api/shop';
import type { ShopCard } from '@/lib/types/shop';
import { useAuthStore } from '@/store/auth-store';

const rarityCardClass: Record<ShopCard['rarity'], string> = {
  COMMON: 'shop-card-common',
  RARE: 'shop-card-rare',
  EPIC: 'shop-card-epic',
  LEGENDARY: 'shop-card-legendary'
};

const rarityBadgeClass: Record<ShopCard['rarity'], string> = {
  COMMON: 'rarity-common',
  RARE: 'rarity-rare',
  EPIC: 'rarity-epic',
  LEGENDARY: 'rarity-legendary'
};

const sortCards = (cards: ShopCard[]) => {
  const rank: Record<ShopCard['rarity'], number> = {
    COMMON: 0,
    RARE: 1,
    EPIC: 2,
    LEGENDARY: 3
  };

  return [...cards].sort((a, b) => {
    const rarityDiff = rank[b.rarity] - rank[a.rarity];
    if (rarityDiff !== 0) return rarityDiff;
    const coinDiff = b.priceCoins - a.priceCoins;
    if (coinDiff !== 0) return coinDiff;
    const gemDiff = b.priceGems - a.priceGems;
    if (gemDiff !== 0) return gemDiff;
    return a.name.localeCompare(b.name);
  });
};

/*
  panel-shop.png is 3934x1939.
  Tab shelf positions from Figma (x, y, w, h):
    TRANG PHỤC: 392.05, 342.12, 142, 34 -> left=9.96% top=17.63% w=3.61% h=1.75%
    VẬT PHẨM:   392,    461,    144, 34 -> left=9.96% top=23.77% w=3.66% h=1.75%
*/
export default function ShopPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [activeTab, setActiveTab] = useState<'trang-phuc' | 'vat-pham'>('trang-phuc');
  const [cards, setCards] = useState<ShopCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [buyingCardId, setBuyingCardId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadCards = async (showSpinner: boolean) => {
    if (!token) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    if (showSpinner) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const response = await fetchShopCards(token);
      setCards(sortCards(response.cards));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load shop cards.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    loadCards(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const currencyText = useMemo(() => {
    if (!user) return 'Coins 0 | Gems 0';
    return `Coins ${user.coins.toLocaleString()} | Gems ${user.gems.toLocaleString()}`;
  }, [user]);

  const handleBuy = async (card: ShopCard) => {
    if (!token || !user) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setBuyingCardId(card.id);
    try {
      const response = await buyShopCard(token, card.id);
      updateUser(response.user);
      setCards((prev) =>
        prev.map((item) =>
          item.id === card.id
            ? { ...item, ownedQuantity: response.purchase.ownedQuantity }
            : item
        )
      );
      setSuccessMessage(
        `Purchased ${response.purchase.cardName}. You now own ${response.purchase.ownedQuantity}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to complete purchase.');
    } finally {
      setBuyingCardId(null);
    }
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="panel-container panel-container-shop">
        <img
          src="/images/ui-game/panel-shop.png"
          className="panel-bg"
          alt=""
        />

        <div className="panel-tabs" role="tablist" aria-label="Shop tabs">
          <button
            onClick={() => setActiveTab('trang-phuc')}
            type="button"
            className={`panel-tab ${activeTab === 'trang-phuc' ? 'panel-tab-active' : ''}`}
            aria-label="Tab Trang Phuc"
            aria-selected={activeTab === 'trang-phuc'}
            role="tab"
          >
            <span className="tab-label">TRANG PHỤC</span>
            <span className="panel-tab-arrow tab-arrow">&gt;</span>
          </button>
          <button
            onClick={() => setActiveTab('vat-pham')}
            type="button"
            className={`panel-tab ${activeTab === 'vat-pham' ? 'panel-tab-active' : ''}`}
            aria-label="Tab Vat Pham"
            aria-selected={activeTab === 'vat-pham'}
            role="tab"
          >
            <span className="tab-label">VẬT PHẨM</span>
            <span className="panel-tab-arrow tab-arrow">&gt;</span>
          </button>
        </div>

        <div className="panel-content space-y-4">
          {activeTab === 'trang-phuc' && (
            <>
              <header className="shop-header-panel animate-fade-in-up">
                <p className="moba-heading text-xs uppercase tracking-[0.24em] text-cyan-300/90">
                  Zodiac Shop
                </p>
                <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
                  Trang Phục
                </h1>
                <p className="mt-2 text-sm text-slate-300/85">
                  Forge your strategy by purchasing tactical cards with Coins and Gems.
                </p>
                <div className="shop-balance-chip mt-4">
                  <span className="shop-currency-coin">Coins</span>
                  <span>{user?.coins.toLocaleString() ?? 0}</span>
                  <span className="text-slate-500">|</span>
                  <span className="shop-currency-gem">Gems</span>
                  <span>{user?.gems.toLocaleString() ?? 0}</span>
                </div>
              </header>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{currencyText}</p>
                <button
                  className="friends-action-button friends-action-button-muted"
                  disabled={isRefreshing || isLoading}
                  onClick={() => loadCards(false)}
                  type="button"
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh Store'}
                </button>
              </div>

              {errorMessage ? (
                <div className="friends-alert friends-alert-error animate-fade-in">{errorMessage}</div>
              ) : null}
              {successMessage ? (
                <div className="friends-alert friends-alert-success animate-fade-in">{successMessage}</div>
              ) : null}

              {isLoading ? (
                <div className="empty-state">
                  <p className="text-sm text-slate-300/90">Loading store inventory...</p>
                </div>
              ) : cards.length === 0 ? (
                <div className="empty-state">
                  <p className="text-sm text-slate-300/90">No cards are available in the shop yet.</p>
                </div>
              ) : (
                <div className="shop-grid">
                  {cards.map((card, index) => {
                    const canAfford = Boolean(
                      user && user.coins >= card.priceCoins && user.gems >= card.priceGems
                    );
                    const isBuying = buyingCardId === card.id;
                    return (
                      <article
                        className={`shop-card ${rarityCardClass[card.rarity]} animate-fade-in-up`}
                        key={card.id}
                        style={{ animationDelay: `${index * 45}ms` }}
                      >
                        <div className="shop-card-tilt">
                          <div className="shop-card-face">
                            <div className="shop-card-art">
                              {card.imageUrl ? (
                                <div
                                  className="shop-card-art-image"
                                  style={{ backgroundImage: `url(${card.imageUrl})` }}
                                />
                              ) : (
                                <div className="shop-card-art-fallback">
                                  <span className="moba-heading text-sm tracking-[0.18em] text-cyan-200">
                                    {card.code}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="shop-card-body">
                              <div className="flex items-center justify-between gap-2">
                                <h2 className="truncate text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                                  {card.name}
                                </h2>
                                <span className={`rarity-badge ${rarityBadgeClass[card.rarity]}`}>
                                  {card.rarity}
                                </span>
                              </div>
                              <p className="mt-2 min-h-[2.8rem] text-xs leading-relaxed text-slate-300/88">
                                {card.description ?? 'A mysterious tactical card from the zodiac arsenal.'}
                              </p>
                              <div className="shop-price-row mt-3">
                                <span className="shop-price-coin">{card.priceCoins} Coins</span>
                                <span className="shop-price-gem">{card.priceGems} Gems</span>
                                <span className="shop-owned-tag">Owned x{card.ownedQuantity}</span>
                              </div>
                              <button
                                className={`shop-buy-button ${
                                  canAfford ? 'shop-buy-button-active' : 'shop-buy-button-disabled'
                                }`}
                                disabled={isBuying || !canAfford}
                                onClick={() => handleBuy(card)}
                                type="button"
                              >
                                {isBuying ? 'Buying...' : canAfford ? 'Buy Card' : 'Not Enough Currency'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* VẬT PHẨM tab */}
          {activeTab === 'vat-pham' && (
            <div className="empty-state animate-fade-in">
              <p className="moba-heading text-lg uppercase tracking-[0.12em] text-amber-100">
                Vật Phẩm
              </p>
              <p className="mt-2 text-sm text-slate-300/85">Coming soon - check back later.</p>
            </div>
          )}
        </div>
      </div>

      <button
        className="panel-back-button"
        onClick={() => router.push('/lobby')}
        type="button"
      >
        <img src="/images/ui-game/btn-back.png" className="w-full" alt="Trở về" />
      </button>
    </div>
  );
}
