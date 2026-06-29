'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { applyShopItem, buyShopItem, fetchShopItems } from '@/lib/api/shop';
import type { ShopItem, ShopItemType, SkinType } from '@/lib/types/shop';
import { useAuthStore } from '@/store/auth-store';

const itemCardClass: Record<ShopItemType, string> = {
  SKIN: 'shop-card-rare',
  ITEM: 'shop-card-common'
};

const itemBadgeClass: Record<ShopItemType, string> = {
  SKIN: 'rarity-rare',
  ITEM: 'rarity-common'
};

const tabToType = {
  'trang-phuc': 'SKIN',
  'vat-pham': 'ITEM'
} as const;

const typeLabels: Record<ShopItemType, string> = {
  SKIN: 'Trang phục',
  ITEM: 'Vật phẩm'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getSkinType = (metadata: unknown): SkinType => {
  if (isRecord(metadata) && typeof metadata.skinType === 'string') {
    const normalized = metadata.skinType.toUpperCase();
    if (normalized === 'DICE') return 'DICE';
    if (normalized === 'MAP') return 'MAP';
  }

  return 'FRAME';
};

const getSkinTypeLabel = (metadata: unknown) => {
  const skinType = getSkinType(metadata);
  if (skinType === 'DICE') return 'XÚC XẮC';
  if (skinType === 'MAP') return 'BẢN ĐỒ';
  return 'FRAME';
};

const isCoinPack = (metadata: unknown) =>
  isRecord(metadata) && metadata.itemType === 'COIN_PACK';

const getCoinPackRewardCoins = (metadata: unknown) => {
  if (!isRecord(metadata)) return 0;
  const rewardCoins = Number(metadata.rewardCoins);
  return Number.isInteger(rewardCoins) && rewardCoins > 0 ? rewardCoins : 0;
};

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
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
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
      setItems(sortItems(response.items.filter((item) => item.type === 'SKIN' || item.type === 'ITEM')));
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
    if (!user) return 'Vàng 0 | Ngọc 0';
    return `Vàng ${user.coins.toLocaleString()} | Ngọc ${user.gems.toLocaleString()}`;
  }, [user]);

  const handleBuy = async (item: ShopItem) => {
    if (!token || !user) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingItemId(item.id);

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
      if (response.purchase.rewardCoins) {
        setSuccessMessage(
          `Đã mua ${response.purchase.itemName} và nhận ${response.purchase.rewardCoins.toLocaleString()} Vàng.`
        );
      } else {
        setSuccessMessage(
          response.purchase.ownedQuantity > item.ownedQuantity
            ? `Đã mua ${response.purchase.itemName}.`
            : `${response.purchase.itemName} đã có trong túi đồ của bạn.`
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể mua vật phẩm.');
    } finally {
      setProcessingItemId(null);
    }
  };

  const handleApply = async (item: ShopItem) => {
    if (!token || item.type !== 'SKIN') return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingItemId(item.id);

    try {
      const response = await applyShopItem(token, item.id);
      const appliedSkinType = getSkinType(item.metadata);
      updateUser(response.user);
      setItems((prev) =>
        prev.map((current) =>
          current.type === 'SKIN' && getSkinType(current.metadata) === appliedSkinType
            ? { ...current, isApplied: current.id === item.id }
            : current
        )
      );
      setSuccessMessage(
        appliedSkinType === 'DICE'
          ? `Đã dùng xúc xắc ${item.name}.`
          : appliedSkinType === 'MAP'
            ? `Đã dùng bản đồ ${item.name}.`
          : `Đã dùng frame ${item.name}.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể dùng trang phục này.');
    } finally {
      setProcessingItemId(null);
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
              CỬA HÀNG 12 CON GIÁP
            </p>
            <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
              {tabTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-300/85">
              Mua trang phục và vật phẩm bằng Vàng hoặc Ngọc. Trang phục đã mua có thể dùng để đổi khung avatar, panel xúc xắc hoặc bộ block bàn cờ trong trận.
            </p>
            <div className="shop-balance-chip mt-4">
              <span className="shop-currency-coin">Vàng</span>
              <span>{user?.coins.toLocaleString() ?? 0}</span>
              <span className="text-slate-500">|</span>
              <span className="shop-currency-gem">Ngọc</span>
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
              <p className="text-sm text-slate-300/90">Chưa có vật phẩm đang bán trong tab này.</p>
            </div>
          ) : (
            <div className="shop-grid">
              {visibleItems.map((item, index) => {
                const canAfford = Boolean(
                  user && user.coins >= item.priceCoins && user.gems >= item.priceGems
                );
                const isProcessing = processingItemId === item.id;
                const isOwned = item.ownedQuantity > 0;
                const canApply = item.type === 'SKIN' && isOwned && !item.isApplied;
                const coinPackRewardCoins = getCoinPackRewardCoins(item.metadata);
                const isCoinPackItem = item.type === 'ITEM' && isCoinPack(item.metadata);

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
                              {item.type === 'SKIN' ? getSkinTypeLabel(item.metadata) : typeLabels[item.type]}
                            </span>
                          </div>
                          <p className="mt-2 min-h-[2.8rem] text-xs leading-relaxed text-slate-300/88">
                            {item.description
                              ?? (isCoinPackItem
                                ? 'Đổi Ngọc để nhận Vàng ngay.'
                                : 'Một vật phẩm bí ẩn trong cửa hàng 12 con giáp.')}
                          </p>
                          <div className="shop-price-row mt-3">
                            <span className="shop-price-coin">{item.priceCoins} Vàng</span>
                            <span className="shop-price-gem">{item.priceGems} Ngọc</span>
                            {isCoinPackItem ? (
                              <span className="shop-owned-tag">
                                Nhận +{coinPackRewardCoins.toLocaleString()} Vàng
                              </span>
                            ) : (
                              <span className="shop-owned-tag">Đã sở hữu x{item.ownedQuantity}</span>
                            )}
                          </div>

                          {item.type === 'SKIN' && item.isApplied ? (
                            <button className="shop-buy-button shop-buy-button-disabled" disabled type="button">
                              Đang dùng
                            </button>
                          ) : canApply ? (
                            <button
                              className="shop-buy-button shop-buy-button-active"
                              disabled={isProcessing}
                              onClick={() => handleApply(item)}
                              type="button"
                            >
                              {isProcessing ? 'Đang dùng...' : 'Dùng'}
                            </button>
                          ) : (
                            <button
                              className={`shop-buy-button ${
                                canAfford ? 'shop-buy-button-active' : 'shop-buy-button-disabled'
                              }`}
                              disabled={isProcessing || !canAfford}
                              onClick={() => handleBuy(item)}
                              type="button"
                            >
                              {isProcessing ? 'Đang mua...' : canAfford ? 'Mua' : 'Không đủ tiền'}
                            </button>
                          )}
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
