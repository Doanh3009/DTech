import { describe,expect,it } from "vitest";
import { createReceiptSchema,customsSchema,scheduleUpdateSchema,shipmentSchema,shipmentStatusSchema } from "./importExportSchemas";
const id=(suffix:string)=>`00000000-0000-4000-8000-${suffix.padStart(12,"0")}`;
describe("shipment validation",()=>{
  it("cho phép air shipment không có container",()=>{expect(shipmentSchema.safeParse({clientRequestId:id("1"),supplierId:id("2"),transportMode:"air",shipmentType:"import",status:"planned",lines:[{itemId:id("3"),expectedQuantity:10,uomId:id("4")}]}).success).toBe(true);});
  it("không cho shipment không có dòng hàng",()=>{expect(shipmentSchema.safeParse({clientRequestId:id("1"),supplierId:id("2"),transportMode:"sea",shipmentType:"import",status:"planned",lines:[]}).success).toBe(false);});
  it("bắt buộc lý do khi hủy",()=>{expect(shipmentStatusSchema.safeParse({status:"cancelled",rowVersion:1}).success).toBe(false);expect(shipmentStatusSchema.safeParse({status:"cancelled",rowVersion:1,reason:"Hủy booking"}).success).toBe(true);});
});
describe("customs and receiving validation",()=>{
  it("customs issue cần nội dung",()=>{expect(customsSchema.safeParse({status:"issue",rowVersion:1}).success).toBe(false);expect(customsSchema.safeParse({status:"issue",issueNote:"Thiếu hồ sơ",rowVersion:1}).success).toBe(true);});
  it("receipt chỉ nhận quantity dương và shipment line UUID",()=>{expect(createReceiptSchema.safeParse({clientRequestId:id("1"),warehouseId:id("2"),receivedDate:"2026-09-12",lines:[{shipmentLineId:id("3"),quantity:60}]}).success).toBe(true);expect(createReceiptSchema.safeParse({clientRequestId:id("1"),warehouseId:id("2"),receivedDate:"2026-09-12",lines:[{shipmentLineId:id("3"),quantity:-1}]}).success).toBe(false);});
  it("schedule có request key để idempotent",()=>{expect(scheduleUpdateSchema.safeParse({newValue:"2026-09-20",source:"forwarder",rowVersion:2,clientRequestId:id("1")}).success).toBe(true);});
});
