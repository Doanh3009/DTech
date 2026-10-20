import {describe,expect,it} from "vitest";
import {safeUploadName,sanitizeSpreadsheetCell,validateUploadedFile} from "./filePolicy";
describe("filePolicy",()=>{
  it("rejects a spoofed PDF",async()=>{const bytes=new TextEncoder().encode("not-pdf");const file={name:"proof.pdf",type:"application/pdf",size:bytes.length,arrayBuffer:async()=>bytes.buffer} as File;await expect(validateUploadedFile(file,{allowedMimeTypes:["application/pdf"],maxBytes:1024})).rejects.toMatchObject({code:"VALIDATION_ERROR"});});
  it("accepts a matching PDF signature",async()=>{const bytes=new TextEncoder().encode("%PDF-1.7\n");const file={name:"proof.pdf",type:"application/pdf",size:bytes.length,arrayBuffer:async()=>bytes.buffer} as File;await expect(validateUploadedFile(file,{allowedMimeTypes:["application/pdf"],maxBytes:1024})).resolves.toBeInstanceOf(Uint8Array);});
  it("neutralizes spreadsheet formulas",()=>{expect(sanitizeSpreadsheetCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");expect(sanitizeSpreadsheetCell("normal")).toBe("normal");});
  it("normalizes upload names",()=>expect(safeUploadName("../../Hóa đơn.pdf")).toBe("Hoa-don.pdf"));
});
