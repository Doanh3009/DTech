"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Checkbox, Input, Select, Textarea } from "@/components/shared/FormControls";
import { ItemImagePreview } from "@/features/warehouse/components/ItemImagePreview";
import type { InventoryItem, ItemCategory, UnitOfMeasure } from "@/features/warehouse/types/warehouseTypes";
import styles from "./WarehouseUi.module.css";

type ApiBody<T> = { ok: boolean; data?: T; error?: { message?: string } };

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as ApiBody<T>;
  if (!response.ok || !body.data) throw new Error(body.error?.message || "Không thể tải dữ liệu.");
  return body.data;
}

async function saveJson<T>(url: string, method: "POST" | "PATCH", payload: object): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = (await response.json()) as ApiBody<T>;
  if (!response.ok || !body.data) throw new Error(body.error?.message || "Không thể lưu dữ liệu.");
  return body.data;
}

async function saveImage(itemId: string, file: File): Promise<InventoryItem> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/v1/items/${itemId}/image`, { method: "POST", body: form });
  const body = (await response.json()) as ApiBody<InventoryItem>;
  if (!response.ok || !body.data) throw new Error(body.error?.message || "Không thể lưu ảnh hàng hóa.");
  return body.data;
}

export function InventoryItemEditor({ id }: { id?: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [item, setItem] = useState<Partial<InventoryItem>>({ trackedInventory: true, status: "active" });
  const [imageFile, setImageFile] = useState<File>();
  const [persistedId, setPersistedId] = useState<string>();
  const [imagePreview, setImagePreview] = useState<string>();
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      read<UnitOfMeasure[]>("/api/v1/uom"),
      read<ItemCategory[]>("/api/v1/item-categories"),
      id ? read<InventoryItem>(`/api/v1/items/${id}`) : Promise.resolve(undefined)
    ])
      .then(([availableUnits, availableCategories, current]) => {
        setUnits(availableUnits);
        setCategories(availableCategories);
        if (current) setItem(current);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu."));
  }, [id]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Ảnh phải có định dạng JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh không được vượt quá 5 MB.");
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveExistingImage(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const effectiveId = id ?? persistedId;
      let saved = await saveJson<InventoryItem>(effectiveId ? `/api/v1/items/${effectiveId}` : "/api/v1/items", effectiveId ? "PATCH" : "POST", {
        itemCode: item.itemCode,
        name: item.name,
        shortName: item.shortName || undefined,
        categoryId: item.categoryId || undefined,
        baseUomId: item.baseUomId,
        specification: item.specification || undefined,
        brand: item.brand || undefined,
        manufacturer: item.manufacturer || undefined,
        countryOfOrigin: item.countryOfOrigin || undefined,
        trackedInventory: item.trackedInventory ?? true,
        status: item.status ?? "active",
        note: item.note || undefined,
        ...(effectiveId ? { rowVersion: item.rowVersion } : {})
      });
      setPersistedId(saved.id);
      setItem(saved);

      if (imageFile) {
        saved = await saveImage(saved.id, imageFile);
      } else if (effectiveId && removeExistingImage && item.imageAssetId) {
        const response = await fetch(`/api/v1/items/${effectiveId}/image`, { method: "DELETE" });
        const body = (await response.json()) as ApiBody<InventoryItem>;
        if (!response.ok || !body.data) throw new Error(body.error?.message || "Không thể xóa ảnh hàng hóa.");
        saved = body.data;
      }

      router.push(`/warehouse/items/${saved.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="warehouse-form page-stack" onSubmit={submit}>
      <Card className={`item-editor-card ${styles.formCard}`}>
        <div className="item-editor-layout">
          <div className="item-editor-image">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Ảnh hàng hóa mới" src={imagePreview} />
            ) : (
              <ItemImagePreview
                assetId={removeExistingImage ? undefined : item.imageAssetId}
                itemName={item.name || "hàng hóa"}
                variant="detail"
              />
            )}
            <input
              aria-label="Chọn ảnh hàng hóa"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={saving}
              onChange={chooseImage}
              ref={fileInput}
              tabIndex={-1}
              type="file"
            />
            <div className="item-editor-image__actions">
              <Button disabled={saving} leftIcon={<ImageUp size={16} />} onClick={() => fileInput.current?.click()} size="sm">
                Chọn ảnh
              </Button>
              {(imageFile || (!removeExistingImage && item.imageAssetId)) ? (
                <Button
                  disabled={saving}
                  leftIcon={<Trash2 size={16} />}
                  onClick={() => {
                    setImageFile(undefined);
                    setImagePreview(undefined);
                    setRemoveExistingImage(Boolean(item.imageAssetId));
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Xóa ảnh
                </Button>
              ) : null}
            </div>
          </div>
          <div className="form-grid">
            <Input label="Mã hàng" required value={item.itemCode ?? ""} onChange={(event) => setItem({ ...item, itemCode: event.target.value })} />
            <Input label="Tên hàng" required value={item.name ?? ""} onChange={(event) => setItem({ ...item, name: event.target.value })} />
            <Input label="Tên ngắn" value={item.shortName ?? ""} onChange={(event) => setItem({ ...item, shortName: event.target.value })} />
            <Select label="Nhóm hàng" options={categories.map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` }))} placeholder="Chưa phân nhóm" value={item.categoryId ?? ""} onChange={(event) => setItem({ ...item, categoryId: event.target.value })} />
            <Select label="Đơn vị cơ sở" required options={units.filter((row) => row.active).map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` }))} placeholder="Chọn đơn vị" value={item.baseUomId ?? ""} onChange={(event) => setItem({ ...item, baseUomId: event.target.value })} />
            <Input label="Quy cách" value={item.specification ?? ""} onChange={(event) => setItem({ ...item, specification: event.target.value })} />
            <Input label="Nhãn hiệu" value={item.brand ?? ""} onChange={(event) => setItem({ ...item, brand: event.target.value })} />
            <Input label="Nhà sản xuất" value={item.manufacturer ?? ""} onChange={(event) => setItem({ ...item, manufacturer: event.target.value })} />
            <Input label="Xuất xứ" value={item.countryOfOrigin ?? ""} onChange={(event) => setItem({ ...item, countryOfOrigin: event.target.value })} />
            <Select label="Trạng thái" options={[{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Ngừng dùng" }]} value={item.status ?? "active"} onChange={(event) => setItem({ ...item, status: event.target.value as InventoryItem["status"] })} />
          </div>
        </div>
        <Checkbox checked={item.trackedInventory ?? true} label="Theo dõi tồn kho" onChange={(event) => setItem({ ...item, trackedInventory: event.target.checked })} />
        <Textarea label="Ghi chú" rows={3} value={item.note ?? ""} onChange={(event) => setItem({ ...item, note: event.target.value })} />
      </Card>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className={`warehouse-sticky-actions ${styles.actions}`}>
        <Button data-ui="back-control" onClick={() => router.back()}>Quay lại</Button>
        <Button disabled={saving} type="submit" variant="primary" busy={saving}>{"Lưu"}</Button>
      </div>
    </form>
  );
}
