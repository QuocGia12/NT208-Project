'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  createAdminShopItem,
  deleteAdminShopItem,
  fetchAdminShopItems,
  toggleAdminShopItemActive,
  updateAdminShopItem
} from '@/lib/api/shop';
import type { AdminShopItem, ShopItemType, UpsertAdminShopItemPayload } from '@/lib/types/shop';
import { useAuthStore } from '@/store/auth-store';

type FormState = {
  type: ShopItemType;
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  priceCoins: string;
  priceGems: string;
  isActive: boolean;
  metadata: string;
};

const createEmptyForm = (): FormState => ({
  type: 'SKIN',
  code: '',
  name: '',
  description: '',
  imageUrl: '',
  priceCoins: '0',
  priceGems: '0',
  isActive: true,
  metadata: ''
});

const itemTypes: ShopItemType[] = ['SKIN', 'ITEM', 'CARD'];

const toFormState = (item: AdminShopItem): FormState => ({
  type: item.type,
  code: item.code,
  name: item.name,
  description: item.description ?? '',
  imageUrl: item.imageUrl ?? '',
  priceCoins: String(item.priceCoins),
  priceGems: String(item.priceGems),
  isActive: item.isActive,
  metadata:
    item.metadata === null || item.metadata === undefined
      ? ''
      : JSON.stringify(item.metadata, null, 2)
});

const parseForm = (form: FormState): UpsertAdminShopItemPayload => {
  const priceCoins = Number(form.priceCoins);
  const priceGems = Number(form.priceGems);

  if (!Number.isInteger(priceCoins) || priceCoins < 0) {
    throw new Error('Coin price must be a non-negative integer.');
  }

  if (!Number.isInteger(priceGems) || priceGems < 0) {
    throw new Error('Gem price must be a non-negative integer.');
  }

  let metadata: unknown;
  if (form.metadata.trim().length > 0) {
    metadata = JSON.parse(form.metadata);
  }

  return {
    type: form.type,
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    priceCoins,
    priceGems,
    isActive: form.isActive,
    ...(metadata !== undefined ? { metadata } : {})
  };
};

export default function AdminShopPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [form, setForm] = useState<FormState>(() => createEmptyForm());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const groupedItems = useMemo(
    () =>
      itemTypes.map((type) => ({
        type,
        items: items.filter((item) => item.type === type)
      })),
    [items]
  );

  const loadItems = async () => {
    if (!token || !isAdmin) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchAdminShopItems(token);
      setItems(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load admin shop.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (!isAdmin) {
      router.replace('/lobby');
      return;
    }

    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !isAdmin) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = parseForm(form);
      if (editingItemId) {
        const response = await updateAdminShopItem(token, editingItemId, payload);
        setItems((prev) => prev.map((item) => (item.id === editingItemId ? response.item : item)));
        setSuccessMessage(`Updated ${response.item.name}.`);
      } else {
        const response = await createAdminShopItem(token, payload);
        setItems((prev) => [response.item, ...prev]);
        setSuccessMessage(`Created ${response.item.name}.`);
      }

      setEditingItemId(null);
      setForm(createEmptyForm());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: AdminShopItem) => {
    setEditingItemId(item.id);
    setForm(toFormState(item));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleToggleActive = async (item: AdminShopItem) => {
    if (!token) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await toggleAdminShopItemActive(token, item.id, !item.isActive);
      setItems((prev) => prev.map((current) => (current.id === item.id ? response.item : current)));
      setSuccessMessage(`${response.item.name} is now ${response.item.isActive ? 'active' : 'inactive'}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to toggle item.');
    }
  };

  const handleDelete = async (item: AdminShopItem) => {
    if (!token) return;
    const confirmed = window.confirm(`Delete ${item.name}? This also removes it from inventories.`);
    if (!confirmed) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteAdminShopItem(token, item.id);
      setItems((prev) => prev.filter((current) => current.id !== item.id));
      if (editingItemId === item.id) {
        setEditingItemId(null);
        setForm(createEmptyForm());
      }
      setSuccessMessage(`Deleted ${item.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete item.');
    }
  };

  if (!token || !isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-amber-100">
        Redirecting...
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-24 text-amber-50">
      <div className="mx-auto max-w-6xl space-y-6 rounded-[2rem] border border-amber-400/40 bg-[#08240f]/90 p-6 shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="moba-heading text-xs uppercase tracking-[0.26em] text-amber-300/80">
              Admin
            </p>
            <h1 className="moba-heading text-3xl uppercase tracking-[0.12em] text-amber-100">
              Shop Items
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-amber-100/75">
              Tạo trang phục, vật phẩm hoặc card bằng imageUrl. Item inactive sẽ không hiện trong shop public.
            </p>
          </div>

          <button
            className="friends-action-button friends-action-button-muted"
            onClick={() => router.push('/shop')}
            type="button"
          >
            Về shop
          </button>
        </header>

        {errorMessage ? (
          <div className="friends-alert friends-alert-error animate-fade-in">{errorMessage}</div>
        ) : null}
        {successMessage ? (
          <div className="friends-alert friends-alert-success animate-fade-in">{successMessage}</div>
        ) : null}

        <form
          className="grid gap-4 rounded-3xl border border-amber-500/30 bg-black/20 p-4 lg:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Type
            <select
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value as ShopItemType }))
              }
            >
              {itemTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Code
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="skin_lunar_cat"
              required
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Name
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Lunar Cat Skin"
              required
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Image URL
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.imageUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
              placeholder="https://..."
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Price Coins
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              min={0}
              step={1}
              type="number"
              value={form.priceCoins}
              onChange={(event) => setForm((prev) => ({ ...prev, priceCoins: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Price Gems
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              min={0}
              step={1}
              type="number"
              value={form.priceGems}
              onChange={(event) => setForm((prev) => ({ ...prev, priceGems: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100 lg:col-span-2">
            Description
            <textarea
              className="min-h-24 w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100 lg:col-span-2">
            Metadata JSON
            <textarea
              className="min-h-28 w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 font-mono text-xs text-amber-50 outline-none"
              value={form.metadata}
              onChange={(event) => setForm((prev) => ({ ...prev, metadata: event.target.value }))}
              placeholder='{"rarity":"RARE"}'
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
            <label className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
              <input
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                type="checkbox"
              />
              Active
            </label>

            <div className="flex flex-wrap gap-3">
              {editingItemId ? (
                <button
                  className="friends-action-button friends-action-button-muted"
                  onClick={() => {
                    setEditingItemId(null);
                    setForm(createEmptyForm());
                  }}
                  type="button"
                >
                  Hủy sửa
                </button>
              ) : null}
              <button className="friends-action-button" disabled={isSaving} type="submit">
                {isSaving ? 'Đang lưu...' : editingItemId ? 'Cập nhật item' : 'Tạo item'}
              </button>
            </div>
          </div>
        </form>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="moba-heading text-2xl uppercase tracking-[0.12em] text-amber-100">
              Existing Items
            </h2>
            <button
              className="friends-action-button friends-action-button-muted"
              disabled={isLoading}
              onClick={loadItems}
              type="button"
            >
              {isLoading ? 'Đang tải...' : 'Refresh'}
            </button>
          </div>

          {groupedItems.map((group) => (
            <div className="space-y-3" key={group.type}>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
                {group.type}
              </h3>
              {group.items.length === 0 ? (
                <p className="rounded-2xl border border-amber-500/20 bg-black/20 p-4 text-sm text-amber-100/70">
                  Chưa có item loại {group.type}.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {group.items.map((item) => (
                    <article
                      className="rounded-2xl border border-amber-500/25 bg-[#071c0d]/80 p-4"
                      key={item.id}
                    >
                      <div className="flex gap-4">
                        <div
                          className="h-20 w-20 flex-shrink-0 rounded-2xl border border-amber-500/30 bg-cover bg-center bg-no-repeat"
                          style={{
                            backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined
                          }}
                        >
                          {!item.imageUrl ? (
                            <div className="flex h-full w-full items-center justify-center text-xs text-amber-200">
                              {item.code}
                            </div>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate font-bold uppercase tracking-[0.08em] text-amber-50">
                              {item.name}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${
                                item.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'
                              }`}
                            >
                              {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-amber-100/65">{item.code}</p>
                          <p className="mt-2 line-clamp-2 text-sm text-amber-100/75">
                            {item.description ?? 'No description.'}
                          </p>
                          <p className="mt-2 text-sm font-bold text-amber-200">
                            {item.priceCoins} Coins | {item.priceGems} Gems
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="friends-action-button friends-action-button-muted"
                          onClick={() => handleEdit(item)}
                          type="button"
                        >
                          Sửa
                        </button>
                        <button
                          className="friends-action-button friends-action-button-muted"
                          onClick={() => handleToggleActive(item)}
                          type="button"
                        >
                          {item.isActive ? 'Ẩn' : 'Hiện'}
                        </button>
                        <button
                          className="friends-action-button friends-action-button-danger"
                          onClick={() => handleDelete(item)}
                          type="button"
                        >
                          Xóa
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
