'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { buyShopItem, fetchShopItems } from '@/lib/api/shop';
import type { ShopItem, ShopItemType } from '@/lib/types/shop';
import { useAuthStore } from '@/store/auth-store';

const itemCardClass: Record<ShopItemType, string> = {
  CARD: 'shop-card-epic',
  SKIN: 'shop-card-rare',
  ITEM: 'shop-card-common'
};

const itemBadgeClass: Record<ShopItemType, string> = {
  CARD: 'rarity-epic',
  SKIN: 'rarity-rare',
  ITEM: 'rarity-common'
};

const tabToType = {
  'trang-phuc': 'SKIN',
  'vat-pham': 'ITEM'
} as const;

const sortItems = (items: ShopItem[]) =>
  [...items].sort((a, b) => {
    const coinDiff = a.priceCoins - b.priceCoins;
    if (coinDiff !== 0) return coinDiff;
    const gemDiff = a.priceGems - b.priceGems;
    if (gemDiff !== 0) return gemDiff;
    return a.name.localeCompare(b.name);
  });

export default function ShopPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [activeTab, setActiveTab] = useState<'trang-phuc' | 'vat-pham'>('trang-phuc');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadItems = async (showSpinner: boolean) => {
    if (!token) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    if (showSpinner) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await fetchShopItems(token);
      setItems(sortItems(response.items));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải cửa hàng.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    loadItems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visibleItems = useMemo(
    () => items.filter((item) => item.type === tabToType[activeTab]),
    [activeTab, items]
  );

  const currencyText = useMemo(() => {
    if (!user) return 'Coins 0 | Gems 0';
    return `Coins ${user.coins.toLocaleString()} | Gems ${user.gems.toLocaleString()}`;
  }, [user]);

  const handleBuy = async (item: ShopItem) => {
    if (!token || !user) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setBuyingItemId(item.id);

    try {
      const response = await buyShopItem(token, item.id);
      updateUser(response.user);
      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? { ...current, ownedQuantity: response.purchase.ownedQuantity }
            : current
        )
      );
      setSuccessMessage(
        `Đã mua ${response.purchase.itemName}. Bạn đang sở hữu ${response.purchase.ownedQuantity}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể mua vật phẩm.');
    } finally {
      setBuyingItemId(null);
    }
  };

  const tabTitle = activeTab === 'trang-phuc' ? 'Trang Phục' : 'Vật Phẩm';

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="panel-container panel-container-shop">
        <img src="/images/ui-game/panel-shop.png" className="panel-bg" alt="" />

        <div className="panel-tabs" role="tablist" aria-label="Shop tabs">
          <button
            onClick={() => setActiveTab('trang-phuc')}
            type="button"
            className={`panel-tab ${activeTab === 'trang-phuc' ? 'panel-tab-active' : ''}`}
            aria-label="Tab Trang Phục"
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
            aria-label="Tab Vật Phẩm"
            aria-selected={activeTab === 'vat-pham'}
            role="tab"
          >
            <span className="tab-label">VẬT PHẨM</span>
            <span className="panel-tab-arrow tab-arrow">&gt;</span>
          </button>
        </div>

        <div className="panel-content space-y-4">
          <header className="shop-header-panel animate-fade-in-up">
            <p className="moba-heading text-xs uppercase tracking-[0.24em] text-cyan-300/90">
              Zodiac Shop
            </p>
            <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
              {tabTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-300/85">
              Mua trang phục và vật phẩm bằng Coins hoặc Gems. Phiên bản này lưu item vào inventory,
              chưa ảnh hưởng trực tiếp tới gameplay.
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
              onClick={() => loadItems(false)}
              type="button"
            >
              {isRefreshing ? 'Đang tải...' : 'Làm mới cửa hàng'}
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
              <p className="text-sm text-slate-300/90">Đang tải cửa hàng...</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm text-slate-300/90">Chưa có item active trong tab này.</p>
            </div>
          ) : (
            <div className="shop-grid">
              {visibleItems.map((item, index) => {
                const canAfford = Boolean(
                  user && user.coins >= item.priceCoins && user.gems >= item.priceGems
                );
                const isBuying = buyingItemId === item.id;

                return (
                  <article
                    className={`shop-card ${itemCardClass[item.type]} animate-fade-in-up`}
                    key={item.id}
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <div className="shop-card-tilt">
                      <div className="shop-card-face">
                        <div className="shop-card-art">
                          {item.imageUrl ? (
                            <div
                              className="shop-card-art-image"
                              style={{ backgroundImage: `url(${item.imageUrl})` }}
                            />
                          ) : (
                            <div className="shop-card-art-fallback">
                              <span className="moba-heading text-sm tracking-[0.18em] text-cyan-200">
                                {item.code}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="shop-card-body">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="truncate text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                              {item.name}
                            </h2>
                            <span className={`rarity-badge ${itemBadgeClass[item.type]}`}>
                              {item.type}
                            </span>
                          </div>
                          <p className="mt-2 min-h-[2.8rem] text-xs leading-relaxed text-slate-300/88">
                            {item.description ?? 'Một vật phẩm bí ẩn trong cửa hàng 12 con giáp.'}
                          </p>
                          <div className="shop-price-row mt-3">
                            <span className="shop-price-coin">{item.priceCoins} Coins</span>
                            <span className="shop-price-gem">{item.priceGems} Gems</span>
                            <span className="shop-owned-tag">Owned x{item.ownedQuantity}</span>
                          </div>
                          <button
                            className={`shop-buy-button ${
                              canAfford ? 'shop-buy-button-active' : 'shop-buy-button-disabled'
                            }`}
                            disabled={isBuying || !canAfford}
                            onClick={() => handleBuy(item)}
                            type="button"
                          >
                            {isBuying ? 'Đang mua...' : canAfford ? 'Mua' : 'Không đủ tiền'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button className="panel-back-button" onClick={() => router.push('/lobby')} type="button">
        <img src="/images/ui-game/btn-back.png" className="w-full" alt="Trở về" />
      </button>
    </div>
  );
}
