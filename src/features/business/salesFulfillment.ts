import { z } from "zod";

const decimal = z.number().finite().min(0).max(1e12).multipleOf(0.0001);
export const salesDeliverySchema = z.object({
  requestId: z.string().uuid(), rowVersion: z.number().int().positive(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value),
  lines: z.array(z.object({ itemId: z.string().uuid(), warehouseId: z.string().uuid(), lotId: z.string().uuid().nullable(), quantity: decimal.min(0.0001), unitCost: decimal }).strict()).min(1).max(50)
}).strict();
export type SalesDeliveryInput = z.infer<typeof salesDeliverySchema>;
export const salesDeliveryReceiptSchema = z.object({ orderId: z.string().uuid(), rowVersion: z.number().int().positive(), stockMoveIds: z.array(z.string().uuid()).min(1).max(50) });
export interface SalesFulfillment {
  orderId: string; code: string; rowVersion: number; status: string;
  items: { itemId: string; code: string; name: string; unit: string; tracking: string; unitCost: number; ordered: number; shipped: number }[];
  stock: { itemId: string; warehouseId: string; warehouse: string; lotId: string | null; lot: string | null; available: number; quality: string | null; expiresOn: string | null }[];
}
