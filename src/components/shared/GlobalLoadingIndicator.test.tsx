import { act,render,screen } from "@testing-library/react";
import { describe,expect,it } from "vitest";
import { beginLoadingActivity } from "@/lib/ui/loadingActivity";
import { GlobalLoadingIndicator } from "./GlobalLoadingIndicator";

describe("shared loading feedback",()=>{
 it("uses a progress strip for page loading without a centered overlay",()=>{const release=beginLoadingActivity("page");try{render(<GlobalLoadingIndicator/>);expect(screen.getByRole("status",{name:"Đang mở trang"})).toBeInTheDocument();expect(document.querySelector('[data-ui="loading-spinner"]')).toBeNull();act(()=>release());expect(screen.queryByRole("status")).not.toBeInTheDocument();}finally{release();}});
 it("retains action feedback when only an action is pending",()=>{const release=beginLoadingActivity("action");try{render(<GlobalLoadingIndicator/>);expect(screen.getByRole("status",{name:"Đang xử lý"})).toBeInTheDocument();act(()=>release());expect(screen.queryByRole("status")).not.toBeInTheDocument();}finally{release();}});
});
