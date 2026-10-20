"use client";

import type { CSSProperties } from "react";

import { navigationIconMap } from "@/components/layout/icons";
import { applicationRegistry, type ApplicationDefinition } from "@/config/moduleRegistry";
import type { Permission } from "@/lib/auth/permissions";
import { EMPLOYEE_ROLE_CODE, withEmployeeBaseline } from "@/services/authorization/employeeAccessPolicy";
import type { RoleDefinition } from "@/services/authorization/rbacService";

import styles from "./RoleAccessSelector.module.css";

export function applicationsForPermissions(permissions: readonly Permission[]): ApplicationDefinition[] {
  const permissionSet = new Set(permissions);
  return applicationRegistry.filter((application) => application.requiredAny.some((permission) => permissionSet.has(permission)));
}

export function applicationsForRoles(roles: readonly RoleDefinition[], selectedRoleIds: readonly string[]): ApplicationDefinition[] {
  const selectedIds = new Set(selectedRoleIds);
  const permissions = roles
    .filter((role) => selectedIds.has(role.id))
    .flatMap((role) => role.permissionKeys);
  return applicationsForPermissions(withEmployeeBaseline(permissions));
}

export function RoleAccessSelector({ roles, selectedRoleIds, onToggle, label = "Vai trò nghiệp vụ" }: {
  roles: readonly RoleDefinition[];
  selectedRoleIds: readonly string[];
  onToggle: (roleId: string) => void;
  label?: string;
}) {
  const applications = applicationsForRoles(roles, selectedRoleIds);

  return (
    <div className={styles.selector}>
      <fieldset aria-label={label} className={styles.roleGrid}>
        <legend className="sr-only">{label}</legend>
        {roles.map((role) => {
          const moduleCount = applicationsForPermissions(role.permissionKeys).length;
          const selected = selectedRoleIds.includes(role.id);
          return (
            <label className={styles.roleOption} data-selected={selected || undefined} key={role.id}>
              <input checked={selected} onChange={() => onToggle(role.id)} type="checkbox" />
              <strong>{role.name}</strong>
              <small>{role.code === EMPLOYEE_ROLE_CODE ? "Mặc định" : `${moduleCount} module`}</small>
            </label>
          );
        })}
      </fieldset>

      <section aria-live="polite" className={styles.preview}>
        <header className={styles.previewHeader}>
          <strong>Module được truy cập</strong>
          <span>{applications.length} module</span>
        </header>
        {applications.length ? (
          <div className={styles.moduleGrid}>
            {applications.map((application) => {
              const Icon = navigationIconMap[application.icon];
              const style = {
                "--module-accent": application.accentColor,
                "--module-soft": application.accentSoft
              } as CSSProperties;
              return (
                <div className={styles.moduleItem} key={application.id} style={style}>
                  <span><Icon aria-hidden="true" size={17} /></span>
                  <span>{application.label}</span>
                </div>
              );
            })}
          </div>
        ) : <span className={styles.empty}>Chưa có module</span>}
      </section>
    </div>
  );
}
