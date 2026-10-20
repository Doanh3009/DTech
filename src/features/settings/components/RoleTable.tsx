"use client";

import { Layers3, MoreHorizontal, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { DropdownMenu } from "@/components/shared/DropdownMenu";
import { Input } from "@/components/shared/FormControls";
import { Modal } from "@/components/shared/Overlays";
import { DataSurface, ListPageLayout } from "@/components/shared/PageLayouts";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { PermissionDefinition, PermissionGroup, RoleDefinition } from "@/services/authorization/rbacService";

import styles from "./AccessManagement.module.css";

type PermissionGroupView = { group: PermissionGroup; permissions: PermissionDefinition[] };

export function RoleTable({ roles, permissionGroups, canManage }: { roles: RoleDefinition[]; permissionGroups: PermissionGroupView[]; canManage: boolean }) {
  const router = useRouter();
  const [editingRole, setEditingRole] = useState<RoleDefinition | null | "new">(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const currentRole = editingRole === "new" ? undefined : editingRole ?? undefined;

  function openEditor(role: RoleDefinition | "new") {
    setEditingRole(role);
    setSelectedPermissions(role === "new" ? [] : role.permissionKeys);
    setError(null);
  }

  function closeEditor() {
    if (submitting) return;
    setEditingRole(null);
    setError(null);
  }

  function togglePermission(permissionKey: string) {
    setSelectedPermissions((current) => current.includes(permissionKey) ? current.filter((key) => key !== permissionKey) : [...current, permissionKey]);
  }

  function togglePermissionGroup(group: PermissionGroupView) {
    const groupKeys = group.permissions.map((permission) => permission.key);
    setSelectedPermissions((current) => {
      const next = new Set(current);
      const allSelected = groupKeys.every((key) => next.has(key));
      groupKeys.forEach((key) => allSelected ? next.delete(key) : next.add(key));
      return [...next];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRole) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) { setError("Tên nhóm quyền cần ít nhất 2 ký tự."); return; }
    if (!selectedPermissions.length) { setError("Chọn ít nhất một quyền cho nhóm."); return; }
    setSubmitting(true);
    setError(null);
    const isNew = editingRole === "new";
    try {
      const response = await fetch(isNew ? "/api/v1/roles" : `/api/v1/roles/${editingRole.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissionKeys: selectedPermissions })
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu nhóm quyền.");
      setEditingRole(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu nhóm quyền.");
    } finally {
      setSubmitting(false);
    }
  }

  const roleColumns: DataTableColumn<RoleDefinition>[] = [
    { id: "name", header: "Nhóm quyền", cell: (role) => <strong>{role.name}</strong> },
    { id: "userCount", header: "Người dùng", cell: (role) => `${role.userCount} tài khoản` },
    { id: "permissions", header: "Phạm vi", cell: (role) => {
      const selected = new Set(role.permissionKeys);
      const moduleCount = permissionGroups.filter((group) => group.permissions.some((permission) => selected.has(permission.key))).length;
      return `${moduleCount} module · ${role.permissionKeys.length} quyền`;
    } },
    { id: "type", header: "Loại", cell: (role) => <StatusBadge tone={role.isSystem ? "info" : "neutral"}>{role.isSystem ? "Hệ thống" : "Tùy chỉnh"}</StatusBadge> }
  ];

  return (
    <ListPageLayout className="role-manager">
      <DataSurface>
        {canManage ? <div className={styles.roleToolbar}><Button leftIcon={<Plus aria-hidden="true" size={17} />} onClick={() => openEditor("new")} variant="primary">Thêm nhóm quyền</Button></div> : null}
        <DataTable
          actions={canManage ? (role) => <DropdownMenu label={`Thao tác ${role.name}`} trigger={<MoreHorizontal aria-hidden="true" size={18} />}><button onClick={() => openEditor(role)} type="button">Chỉnh sửa quyền</button></DropdownMenu> : undefined}
          columns={roleColumns}
          data={roles}
          getRowId={(role) => role.id}
        />
      </DataSurface>

      <Modal className={styles.roleModal} open={editingRole !== null} title={editingRole === "new" ? "Thêm nhóm quyền" : "Chỉnh sửa nhóm quyền"} onClose={closeEditor}>
        <form className={styles.accessForm} key={currentRole?.id ?? "new"} onSubmit={handleSubmit}>
          <section className={styles.formSection}>
            <h3><ShieldCheck aria-hidden="true" size={18} /> Thông tin nhóm quyền</h3>
            <Input defaultValue={currentRole?.name} label="Tên nhóm quyền" maxLength={120} minLength={2} name="name" required />
          </section>
          <section className={styles.formSection}>
            <h3><Layers3 aria-hidden="true" size={18} /> Quyền theo module <StatusBadge tone="info">{selectedPermissions.length} đã chọn</StatusBadge></h3>
            <div className={styles.permissionEditor}>
              {permissionGroups.map((group) => {
                const selectedCount = group.permissions.filter((permission) => selectedPermissions.includes(permission.key)).length;
                const allSelected = selectedCount === group.permissions.length;
                return (
                  <fieldset className={styles.permissionGroup} key={group.group}>
                    <legend>{group.group}</legend>
                    <div className={styles.permissionGroupTools}>
                      <StatusBadge tone={selectedCount ? "info" : "neutral"}>{selectedCount}/{group.permissions.length}</StatusBadge>
                      <button onClick={() => togglePermissionGroup(group)} type="button">{allSelected ? "Bỏ chọn" : "Chọn tất cả"}</button>
                    </div>
                    {group.permissions.map((permission) => (
                      <label data-selected={selectedPermissions.includes(permission.key) || undefined} key={permission.key}>
                        <input checked={selectedPermissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} type="checkbox" />
                        <span>{permission.label}</span>
                        {permission.sensitive ? <StatusBadge tone="warning">Nhạy cảm</StatusBadge> : null}
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>
          </section>
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          <footer className={styles.formFooter}><Button onClick={closeEditor}>Hủy</Button><Button disabled={submitting || selectedPermissions.length === 0} type="submit" variant="primary" busy={submitting}>{"Lưu nhóm quyền"}</Button></footer>
        </form>
      </Modal>
    </ListPageLayout>
  );
}
