import {afterEach,describe,expect,it,vi} from "vitest";
import {confirmBusinessNavigation} from "./businessNavigationGuard";
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
describe("business navigation draft protection",()=>{
 it("allows navigation while only saved documents are present",()=>{const prompt=vi.spyOn(window,"confirm");document.body.innerHTML='<div data-business-unsaved="false"></div>';expect(confirmBusinessNavigation()).toBe(true);expect(prompt).not.toHaveBeenCalled();});
 it("keeps pending document changes when the user cancels navigation",()=>{document.body.innerHTML='<div data-business-unsaved="true"></div>';vi.spyOn(window,"confirm").mockReturnValue(false);expect(confirmBusinessNavigation()).toBe(false);expect(window.confirm).toHaveBeenCalledOnce();});
 it("lets the user leave an explicitly discarded draft",()=>{document.body.innerHTML='<div data-business-unsaved="true"></div>';vi.spyOn(window,"confirm").mockReturnValue(true);expect(confirmBusinessNavigation()).toBe(true);});
});
