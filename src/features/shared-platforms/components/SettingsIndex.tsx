"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, Boxes, Building2, CalendarCheck2, ChartNoAxesCombined, ChevronDown, ChevronRight, Clock3, FolderKanban, Plug, ShieldCheck, Ship, Users, type LucideIcon } from "lucide-react";
import { SearchInput } from "@/components/shared/FormControls";
import { EmptyState } from "@/components/shared/States";

export interface SettingsCatalogItem { key: string; group_key: string; label: string; route: string }

const groupLabels: Record<string, string> = {
  organization: "Tổ chức", human_resources: "Nhân sự", attendance: "Chấm công",
  approval: "Nghỉ phép & Phê duyệt", projects: "Dự án", warehouse: "Kho",
  import_export: "Xuất nhập khẩu", reports: "Báo cáo", notifications: "Thông báo",
  integrations: "Tích hợp", security: "Bảo mật"
};

const groupIcons: Record<string, LucideIcon> = {
  organization: Building2, human_resources: Users, attendance: Clock3,
  approval: CalendarCheck2, projects: FolderKanban, warehouse: Boxes,
  import_export: Ship, reports: ChartNoAxesCombined, notifications: Bell,
  integrations: Plug, security: ShieldCheck
};

function searchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi-VN").trim();
}

export function SettingsIndex({ items }: { items: SettingsCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["organization"]));
  const filteredItems = useMemo(() => {
    const text = searchText(query);
    return text ? items.filter((item) => searchText(item.label).includes(text)) : items;
  }, [items, query]);

  return (
    <div className="settings-index">
      <SearchInput label="Tìm cài đặt" placeholder="Tìm cài đặt, ví dụ bán kính GPS" value={query} onChange={(event) => setQuery(event.target.value)} />
      {filteredItems.length ? (
        <div className="settings-groups">
          {Object.entries(groupLabels).map(([key, label]) => {
            const group = filteredItems.filter((item) => item.group_key === key);
            if (!group.length) return null;
            const Icon = groupIcons[key];
            const expanded = Boolean(query.trim()) || openGroups.has(key);
            return <section className="settings-catalog-group" data-expanded={expanded} key={key}>
              <h2 className="settings-catalog-group__desktop-title">{label}</h2>
              <button aria-controls={`settings-group-${key}`} aria-expanded={expanded} className="settings-catalog-group__toggle" onClick={() => setOpenGroups((current) => {
                const next = new Set(current);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              })} type="button">
                <span className="settings-catalog-group__icon"><Icon aria-hidden="true" size={20} /></span>
                <span>{label}</span><span className="settings-catalog-group__count">{group.length}</span>
                <ChevronDown aria-hidden="true" className="settings-catalog-group__chevron" size={18} />
              </button>
              <div className="settings-catalog-group__items" id={`settings-group-${key}`}>{group.map((item) => <Link href={item.route} key={item.key}><span>{item.label}</span><ChevronRight aria-hidden="true" className="settings-catalog-group__link-arrow" size={16} /></Link>)}</div>
            </section>;
          })}
        </div>
      ) : <EmptyState title="Không tìm thấy cài đặt" />}
    </div>
  );
}
