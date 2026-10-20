import "server-only";
import { getProject } from "./projectRepository";
import { listDocuments, listInventory, listWarehouses } from "@/features/warehouse/services/warehouseRepository";
import type { ProjectMaterials } from "../types/projectMaterials";
import type { InventoryDocument } from "@/features/warehouse/types/warehouseTypes";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser, type Permission } from "@/lib/auth/permissions";

export async function getProjectMaterials(user: AuthenticatedUser, projectId: string, worksiteId?: string): Promise<ProjectMaterials> {
  if (!can(user.permissions, "warehouse.view")) throw new AppError("PERMISSION_DENIED");
  const project = await getProject(projectId, user);
  if (worksiteId && !project.worksites.some(site => site.id === worksiteId)) throw new AppError("NOT_FOUND", "Công trường không thuộc dự án này.");
  const worksiteIds = new Set(project.worksites.map(site => site.id));
  const warehouses = (await listWarehouses(user)).filter(warehouse => (warehouse.projectId === projectId || warehouse.worksiteId && worksiteIds.has(warehouse.worksiteId)) && (!worksiteId || !warehouse.worksiteId || warehouse.worksiteId === worksiteId));
  const canViewDocuments = ["receipt", "issue", "transfer", "adjustment"].some(type => can(user.permissions, `warehouse.${type}.view` as Permission));
  const [inventory, direct] = await Promise.all([listInventory(user, { warehouseIds: warehouses.map(warehouse => warehouse.id) }), canViewDocuments ? listDocuments(user, undefined, { projectId, worksiteId, limit: 30 }) : Promise.resolve([])]);
  const documents = new Map<string, InventoryDocument>(direct.map(document => [document.id, document]));
  if (canViewDocuments) for (let offset = 0; offset < warehouses.length; offset += 4) {
    const batches = await Promise.all(warehouses.slice(offset, offset + 4).map(warehouse => listDocuments(user, undefined, { warehouseId: warehouse.id, limit: 30 })));
    for (const document of batches.flat()) if (!worksiteId || !document.worksiteId || document.worksiteId === worksiteId) documents.set(document.id, document);
  }
  return { warehouses, inventory, documents: [...documents.values()].sort((a, b) => (b.postingDate ?? b.documentDate).localeCompare(a.postingDate ?? a.documentDate) || b.id.localeCompare(a.id)).slice(0, 30), canViewDocuments };
}
