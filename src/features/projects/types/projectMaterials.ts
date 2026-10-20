import type { InventoryBalance, InventoryDocument, Warehouse } from "@/features/warehouse/types/warehouseTypes";
export interface ProjectMaterials {
  warehouses: Warehouse[];
  inventory: InventoryBalance[];
  documents: InventoryDocument[];
  canViewDocuments: boolean;
}
