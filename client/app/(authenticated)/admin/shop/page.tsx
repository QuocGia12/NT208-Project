'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  createAdminShopItem,
  deleteAdminShopItem,
  fetchAdminShopItems,
  toggleAdminShopItemActive,
  updateAdminShopItem,
  uploadAdminShopImage,
  uploadAdminShopMap
} from '@/lib/api/shop';
import type {
  AdminShopItem,
  ShopItemKind,
  ShopItemType,
  SkinType,
  UpsertAdminShopItemPayload
} from '@/lib/types/shop';
import { useAuthStore } from '@/store/auth-store';

type FormState = {
  type: ShopItemType;
  skinType: SkinType;
  itemKind: ShopItemKind;
  rewardCoins: string;
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  metadata: unknown;
  priceCoins: string;
  priceGems: string;
  isActive: boolean;
};

const itemTypes: ShopItemType[] = ['SKIN', 'ITEM'];
const skinTypes: SkinType[] = ['FRAME', 'DICE', 'MAP'];
const itemKinds: ShopItemKind[] = ['STANDARD', 'COIN_PACK'];

const typeLabels: Record<ShopItemType, string> = {
  SKIN: 'Trang phục',
  ITEM: 'Vật phẩm'
};

const skinTypeLabels: Record<SkinType, string> = {
  FRAME: 'Khung',
  DICE: 'Xúc xắc',
  MAP: 'Bản đồ'
};

const itemKindLabels: Record<ShopItemKind, string> = {
  STANDARD: 'Vật phẩm thường',
  COIN_PACK: 'Gói vàng'
};

const createEmptyForm = (): FormState => ({
  type: 'SKIN',
  skinType: 'FRAME',
  itemKind: 'STANDARD',
  rewardCoins: '0',
  code: '',
  name: '',
  description: '',
  imageUrl: '',
  metadata: null,
  priceCoins: '0',
  priceGems: '0',
  isActive: true
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getSkinType = (metadata: unknown): SkinType => {
  if (isRecord(metadata) && typeof metadata.skinType === 'string') {
    const normalized = metadata.skinType.toUpperCase();
    if (normalized === 'FRAME') return 'FRAME';
    if (normalized === 'DICE') return 'DICE';
    if (normalized === 'MAP') return 'MAP';
  }

  return 'FRAME';
};

const getItemKind = (metadata: unknown): ShopItemKind => {
  if (isRecord(metadata) && metadata.itemType === 'COIN_PACK') {
    return 'COIN_PACK';
  }

  return 'STANDARD';
};

const getRewardCoins = (metadata: unknown) => {
  if (!isRecord(metadata)) return 0;
  const rewardCoins = Number(metadata.rewardCoins);
  return Number.isInteger(rewardCoins) && rewardCoins > 0 ? rewardCoins : 0;
};

const toFormState = (item: AdminShopItem): FormState => ({
  type: item.type,
  skinType: item.type === 'SKIN' ? getSkinType(item.metadata) : 'FRAME',
  itemKind: item.type === 'ITEM' ? getItemKind(item.metadata) : 'STANDARD',
  rewardCoins: item.type === 'ITEM' ? String(getRewardCoins(item.metadata)) : '0',
  code: item.code,
  name: item.name,
  description: item.description ?? '',
  imageUrl: item.imageUrl ?? '',
  metadata: item.metadata ?? null,
  priceCoins: String(item.priceCoins),
  priceGems: String(item.priceGems),
  isActive: item.isActive
});

const parseForm = (form: FormState): UpsertAdminShopItemPayload => {
  const priceCoins = Number(form.priceCoins);
  const priceGems = Number(form.priceGems);

  if (!Number.isInteger(priceCoins) || priceCoins < 0) {
    throw new Error('Giá coin phải là số nguyên không âm.');
  }

  if (!Number.isInteger(priceGems) || priceGems < 0) {
    throw new Error('Giá gem phải là số nguyên không âm.');
  }

  const rewardCoins = Number(form.rewardCoins);
  if (form.type === 'ITEM' && form.itemKind === 'COIN_PACK') {
    if (!Number.isInteger(rewardCoins) || rewardCoins <= 0) {
      throw new Error('Số vàng nhận được phải là số nguyên dương.');
    }
  }

  return {
    type: form.type,
    ...(form.type === 'SKIN' ? { skinType: form.skinType } : {}),
    ...(form.type === 'ITEM' ? { itemKind: form.itemKind } : {}),
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    priceCoins,
    priceGems,
    isActive: form.isActive,
    ...(form.type === 'SKIN' && form.skinType === 'MAP' ? { metadata: form.metadata } : {}),
    ...(form.type === 'ITEM' && form.itemKind === 'COIN_PACK'
      ? { metadata: { itemType: 'COIN_PACK', rewardCoins } }
      : form.type === 'ITEM'
        ? { metadata: null }
        : {})
  };
};

const readFileAsDataUrl = (file: File, errorLabel: string) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error(`Không thể đọc ${errorLabel}.`));
    };
    reader.onerror = () => reject(new Error(`Không thể đọc ${errorLabel}.`));
    reader.readAsDataURL(file);
  });

export default function AdminShopPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [form, setForm] = useState<FormState>(() => createEmptyForm());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
      setItems(response.items.filter((item) => item.type === 'SKIN' || item.type === 'ITEM'));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải admin shop.');
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
        setSuccessMessage(`Đã cập nhật ${response.item.name}.`);
      } else {
        const response = await createAdminShopItem(token, payload);
        setItems((prev) => [response.item, ...prev]);
        setSuccessMessage(`Đã tạo ${response.item.name}.`);
      }

      setEditingItemId(null);
      setForm(createEmptyForm());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!token) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const dataUrl = await readFileAsDataUrl(file, 'file ảnh');
      const response = await uploadAdminShopImage(token, {
        fileName: file.name,
        dataUrl
      });
      setForm((prev) => ({ ...prev, imageUrl: response.imageUrl, metadata: null }));
      setSuccessMessage('Đã upload ảnh và gán vào Image URL.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể upload ảnh.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMapUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!token) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (form.code.trim().length === 0) {
      setErrorMessage('Hãy nhập code item trước khi upload file zip bản đồ.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const dataUrl = await readFileAsDataUrl(file, 'file zip bản đồ');
      const response = await uploadAdminShopMap(token, {
        code: form.code.trim(),
        fileName: file.name,
        dataUrl
      });
      setForm((prev) => ({
        ...prev,
        imageUrl: response.imageUrl,
        metadata: response.metadata
      }));
      setSuccessMessage('Đã upload zip bản đồ và gán preview/map assets vào item.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể upload zip bản đồ.');
    } finally {
      setIsUploading(false);
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
      setSuccessMessage(`${response.item.name} hiện ${response.item.isActive ? 'đang bán' : 'đã ẩn'}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể đổi trạng thái item.');
    }
  };

  const handleDelete = async (item: AdminShopItem) => {
    if (!token) return;
    const confirmed = window.confirm(`Xóa ${item.name}? Item này cũng sẽ bị xóa khỏi inventory.`);
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
      setSuccessMessage(`Đã xóa ${item.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể xóa item.');
    }
  };

  if (!token || !isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-amber-100">
        Đang chuyển hướng...
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-24 text-amber-50">
      <div className="mx-auto max-w-6xl space-y-6 rounded-[2rem] border border-amber-400/40 bg-[#08240f]/90 p-6 shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="moba-heading text-xs uppercase tracking-[0.26em] text-amber-300/80">
              QUẢN TRỊ
            </p>
            <h1 className="moba-heading text-3xl uppercase tracking-[0.12em] text-amber-100">
              Quản lý shop
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-amber-100/75">
              Tạo trang phục và vật phẩm cho cửa hàng. Trang phục hiện hỗ trợ Frame, Xúc xắc và Bản đồ. Với bản đồ, admin upload một file zip để sinh preview và toàn bộ texture block.
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
            Loại item
            <select
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as ShopItemType,
                  metadata: event.target.value === 'SKIN' ? prev.metadata : null,
                  itemKind: event.target.value === 'ITEM' ? prev.itemKind : 'STANDARD'
                }))
              }
            >
              {itemTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type]}
                </option>
              ))}
            </select>
          </label>

          {form.type === 'SKIN' ? (
            <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
              Loại trang phục
              <select
                className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
                value={form.skinType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    skinType: event.target.value as SkinType,
                    metadata: event.target.value === 'MAP' ? prev.metadata : null
                  }))
                }
              >
                {skinTypes.map((type) => (
                  <option key={type} value={type}>
                    {skinTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {form.type === 'ITEM' ? (
            <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
              Loại vật phẩm
              <select
                className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
                value={form.itemKind}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    itemKind: event.target.value as ShopItemKind,
                    metadata: event.target.value === 'COIN_PACK'
                      ? { itemType: 'COIN_PACK', rewardCoins: Number(prev.rewardCoins) || 0 }
                      : null
                  }))
                }
              >
                {itemKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {itemKindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Mã
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="frame_lunar_cat"
              required
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Tên
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={
                form.skinType === 'DICE'
                  ? 'Xúc xắc hổ vàng'
                  : form.skinType === 'MAP'
                    ? 'Bản đồ Trẩy Hội Mùa Xuân'
                    : 'Frame mèo thần tài'
              }
              required
            />
          </label>

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100 lg:col-span-2">
            {form.type === 'SKIN' && form.skinType === 'MAP'
              ? 'URL xem trước hoặc upload zip bản đồ'
              : 'URL ảnh hoặc upload ảnh'}
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
                value={form.imageUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                placeholder={
                  form.type === 'SKIN' && form.skinType === 'MAP'
                    ? 'Preview sẽ tự điền sau khi upload zip'
                    : 'https://... hoặc upload file bên dưới'
                }
              />
              {form.type === 'SKIN' && form.skinType === 'MAP' ? (
                <label className="friends-action-button friends-action-button-muted flex cursor-pointer items-center justify-center">
                  {isUploading ? 'Đang upload...' : 'Upload zip bản đồ'}
                  <input
                    accept=".zip,application/zip,application/x-zip-compressed"
                    className="hidden"
                    disabled={isUploading}
                    onChange={handleMapUpload}
                    type="file"
                  />
                </label>
              ) : (
                <label className="friends-action-button friends-action-button-muted flex cursor-pointer items-center justify-center">
                  {isUploading ? 'Đang upload...' : 'Upload ảnh'}
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={isUploading}
                    onChange={handleUpload}
                    type="file"
                  />
                </label>
              )}
            </div>
            {form.type === 'SKIN' && form.skinType === 'MAP' ? (
              <p className="text-xs normal-case tracking-normal text-amber-100/70">
                Zip phải chứa đúng các file: `add-card.png`, `preview.png`, và 12 block zodiac:
                `ty.png`, `suu.png`, `dan.png`, `mao.png`, `thin.png`, `ti.png`, `ngo.png`,
                `mui.png`, `than.png`, `dau.png`, `tuat.png`, `hoi.png`.
              </p>
            ) : null}
          </label>

          {form.imageUrl ? (
            <div className="lg:col-span-2">
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
                Xem trước
              </p>
              <div
                className="h-28 w-28 rounded-2xl border border-amber-500/30 bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${form.imageUrl})` }}
              />
            </div>
          ) : null}

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
            Giá Coins
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
            Giá Gems
            <input
              className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              min={0}
              step={1}
              type="number"
              value={form.priceGems}
              onChange={(event) => setForm((prev) => ({ ...prev, priceGems: event.target.value }))}
            />
          </label>

          {form.type === 'ITEM' && form.itemKind === 'COIN_PACK' ? (
            <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100 lg:col-span-2">
              Số vàng nhận được
              <input
                className="w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
                min={1}
                step={1}
                type="number"
                value={form.rewardCoins}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    rewardCoins: event.target.value,
                    metadata: { itemType: 'COIN_PACK', rewardCoins: Number(event.target.value) || 0 }
                  }))
                }
              />
              <p className="text-xs normal-case tracking-normal text-amber-100/70">
                User mua gói này bằng giá ở trên, sau đó nhận ngay số vàng này. Gói vàng không cộng vào túi đồ.
              </p>
            </label>
          ) : null}

          <label className="space-y-1 text-sm font-bold uppercase tracking-[0.1em] text-amber-100 lg:col-span-2">
            Mô tả
            <textarea
              className="min-h-24 w-full rounded-xl border border-amber-500/30 bg-[#071c0d] px-3 py-3 text-amber-50 outline-none"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
            <label className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
              <input
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                type="checkbox"
              />
              Đang bán
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
              <button className="friends-action-button" disabled={isSaving || isUploading} type="submit">
                {isSaving ? 'Đang lưu...' : editingItemId ? 'Cập nhật item' : 'Tạo item'}
              </button>
            </div>
          </div>
        </form>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="moba-heading text-2xl uppercase tracking-[0.12em] text-amber-100">
              Item hiện có
            </h2>
            <button
              className="friends-action-button friends-action-button-muted"
              disabled={isLoading}
              onClick={loadItems}
              type="button"
            >
              {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>

          {groupedItems.map((group) => (
            <div className="space-y-3" key={group.type}>
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">
                {typeLabels[group.type]}
              </h3>
              {group.items.length === 0 ? (
                <p className="rounded-2xl border border-amber-500/20 bg-black/20 p-4 text-sm text-amber-100/70">
                  Chưa có {typeLabels[group.type].toLowerCase()}.
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
                          className="h-20 w-20 flex-shrink-0 rounded-2xl border border-amber-500/30 bg-contain bg-center bg-no-repeat"
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
                              {item.isActive ? 'ĐANG BÁN' : 'ĐÃ ẨN'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-amber-100/65">{item.code}</p>
                          {item.type === 'SKIN' ? (
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">
                              {skinTypeLabels[getSkinType(item.metadata)]}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">
                              {itemKindLabels[getItemKind(item.metadata)]}
                              {getItemKind(item.metadata) === 'COIN_PACK'
                                ? ` +${getRewardCoins(item.metadata).toLocaleString()} Vàng`
                                : ''}
                            </p>
                          )}
                          <p className="mt-2 line-clamp-2 text-sm text-amber-100/75">
                            {item.description ?? 'Không có mô tả.'}
                          </p>
                          <p className="mt-2 text-sm font-bold text-amber-200">
                            {item.priceCoins} Vàng | {item.priceGems} Ngọc
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
