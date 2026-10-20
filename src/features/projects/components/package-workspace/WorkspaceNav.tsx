"use client";

import { Boxes, ClipboardList, Files, HardHat, Home, UsersRound } from "lucide-react";
import { useEffect, useMemo } from "react";

import { useMobileNavigation } from "@/components/layout/MobileNavigationContext";
import { ContextTabs } from "@/components/shared/Tabs";
import type { MobileNavDestination } from "@/config/mobileNavigationResolver";

import styles from "./PackageWorkspace.module.css";

const workspaceSections = [
  { value: "today", label: "Hôm nay", Icon: Home, navIcon: "LayoutDashboard" },
  { value: "progress", label: "Công việc", Icon: HardHat, navIcon: "HardHat" },
  { value: "team", label: "Nhân lực", Icon: UsersRound, navIcon: "UsersRound" },
  { value: "materials", label: "Vật tư", Icon: Boxes, navIcon: "Boxes" },
  { value: "profile", label: "Thông tin", Icon: ClipboardList, navIcon: "ClipboardCheck" },
  { value: "documents", label: "Tài liệu", Icon: Files, navIcon: "FolderArchive" }
] as const;

export type PackageWorkspaceSection = (typeof workspaceSections)[number]["value"];

export function WorkspaceNav({ projectId, section, visibleSections, selectedWorksiteId, canOpenAttendance, onSelect }: {
  projectId: string;
  section: string;
  visibleSections: readonly PackageWorkspaceSection[];
  selectedWorksiteId?: string;
  canOpenAttendance: boolean;
  onSelect: (section: PackageWorkspaceSection) => void;
}) {
  const { register } = useMobileNavigation();
  const desktopItems = workspaceSections.filter((item) => visibleSections.includes(item.value));
  const worksiteQuery = selectedWorksiteId ? `?worksite=${encodeURIComponent(selectedWorksiteId)}` : "";
  const attendanceHref = `/worker-attendance/today?projectId=${projectId}${selectedWorksiteId ? `&worksiteId=${encodeURIComponent(selectedWorksiteId)}` : ""}`;
  const mobileItems = useMemo<MobileNavDestination[]>(() => {
    const orderedSections = ["today", "progress", "team"] as const;
    const first: MobileNavDestination[] = orderedSections.flatMap((value) => {
      const item = workspaceSections.find((sectionItem) => sectionItem.value === value);
      return item && visibleSections.includes(value) ? [{ href: `/projects/${projectId}/${value}${worksiteQuery}`, label: item.label, icon: item.navIcon }] : [];
    });
    if (canOpenAttendance) first.push({ href: attendanceHref, label: "Điểm danh", icon: "Camera" });
    for (const value of ["materials", "documents", "profile"] as const) {
      const item = workspaceSections.find((sectionItem) => sectionItem.value === value);
      if (item && visibleSections.includes(value)) first.push({ href: `/projects/${projectId}/${value}${worksiteQuery}`, label: item.label, icon: item.navIcon });
    }
    return first;
  }, [attendanceHref, canOpenAttendance, projectId, visibleSections, worksiteQuery]);

  useEffect(() => register(mobileItems), [mobileItems, register]);

  return (
    <>
      <ContextTabs
        className={styles.workspaceNav}
        items={desktopItems.map((item) => ({
          active: item.value === section,
          href: `/projects/${projectId}/${item.value}${worksiteQuery}`,
          icon: <item.Icon aria-hidden="true" size={18} strokeWidth={1.8} />,
          label: item.label,
          onSelect: () => onSelect(item.value)
        }))}
        label="Không gian làm việc gói"
      />
    </>
  );
}
