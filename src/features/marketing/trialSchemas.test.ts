import { describe,expect,it } from "vitest";
import { trialRequestSchema,trialReviewSchema } from "./trialSchemas";

import { validTrial } from "./testFixtures";
describe("public trial input",()=>{
 it("normalizes contact fields without changing request identity",()=>{const result=trialRequestSchema.parse({...validTrial,email:" CONTACT@EXAMPLE.INVALID ",companyName:" Công ty mẫu "});expect(result.email).toBe("contact@example.invalid");expect(result.companyName).toBe("Công ty mẫu");expect(result.requestId).toBe(validTrial.requestId);});
 for(const [field,value] of [["consent",false],["consent","true"],["companyName"," "],["contactName","x"],["email","invalid"],["phone","123"],["phone","abc123456789"],["companySize","unknown"],["industry","finance"],["requestId","not-uuid"],["needs","x".repeat(1501)],["website","bot.example"]] as const)it(`rejects ${field} ${String(value).slice(0,12)}`,()=>expect(trialRequestSchema.safeParse({...validTrial,[field]:value}).success).toBe(false));
 it("rejects extra fields and missing consent",()=>{expect(trialRequestSchema.safeParse({...validTrial,actorId:"attacker"}).success).toBe(false);const {consent:unused,...input}=validTrial;expect(unused).toBe(true);expect(trialRequestSchema.safeParse(input).success).toBe(false);});
 it("allows a blank optional honeypot and needs",()=>expect(trialRequestSchema.safeParse({...validTrial,website:"",needs:""}).success).toBe(true));
 it("requires a positive CAS version and a bounded review reason",()=>{expect(trialReviewSchema.safeParse({rowVersion:1,status:"contacted",reason:"Đã liên hệ"}).success).toBe(true);for(const input of [{rowVersion:0,status:"contacted",reason:"abc"},{rowVersion:1,status:"new",reason:"abc"},{rowVersion:1,status:"closed",reason:" "},{rowVersion:1,status:"closed",reason:"x".repeat(501)}])expect(trialReviewSchema.safeParse(input).success).toBe(false);});
});
