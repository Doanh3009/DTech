import {render,screen,within} from "@testing-library/react";
import {describe,expect,it,vi} from "vitest";
import {BusinessWorkArea} from "./BusinessWorkArea";
import {BusinessAreaLinks} from "./BusinessAreaLinks";
import {businessIndustries} from "./businessCatalog";
import type {BusinessWorkspace} from "./businessSchemas";
vi.mock("./BusinessLink",()=>({BusinessLink:({children,...props}:React.ComponentProps<"a">)=><a {...props}>{children}</a>}));
const workspace={slug:"acme",industry:"construction",features:businessIndustries.construction.features,role:"owner"} as BusinessWorkspace;
describe("ERP workflow work area",()=>{
 it("shows related working tabs and keeps lines in a closed contextual section",()=>{
  const {container}=render(<BusinessWorkArea workspace={workspace} feature="purchasing" activeKind="purchase_orders"><div>Working records</div></BusinessWorkArea>);
  expect(screen.getByText("Đặt mua & nhận hàng")).toBeVisible();const nav=screen.getByRole("navigation",{name:"Quy trình Đặt mua & nhận hàng"});
  expect(within(nav).getAllByRole("link")).toHaveLength(2);expect(within(nav).getByRole("link",{name:"Đơn mua hàng"})).toHaveAttribute("aria-current","page");
  expect(container.querySelector("details")).not.toHaveAttribute("open");expect(screen.getByRole("link",{name:"Chi tiết đơn mua"})).not.toBeVisible();expect(screen.getByText("Working records")).toBeVisible();
 });
 it("opens and selects a direct detail without mapping the view to its parent",()=>{
  const {container}=render(<BusinessWorkArea workspace={workspace} feature="purchasing" activeKind="purchase_lines"><div>Filtered purchase line</div></BusinessWorkArea>);
  expect(container.querySelector("details")).toHaveAttribute("open");expect(screen.getByRole("link",{name:"Chi tiết đơn mua"})).toHaveAttribute("aria-current","page");
  expect(container.querySelector('[data-ui="business-work-area"]')).toHaveAttribute("data-active-kind","purchase_lines");
 });
 it("keeps catalogs collapsed on the module fallback",()=>{
  render(<BusinessAreaLinks workspace={workspace} feature="inventory"/>);
  expect(screen.getByRole("link",{name:"Nhập xuất & kiểm kê"})).toBeVisible();expect(screen.getByRole("link",{name:"Vật tư & kho"})).not.toBeVisible();
 });
});
