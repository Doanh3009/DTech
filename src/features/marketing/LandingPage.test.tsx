import { fireEvent,render,screen } from "@testing-library/react";
import { describe,expect,it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("public product page",()=>{
 it("has one product headline and distinct trial/login destinations",()=>{render(<LandingPage/>);expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);expect(screen.getByRole("link",{name:"Đăng ký dùng thử"})).toHaveAttribute("href","/dang-ky-dung-thu");expect(screen.getByRole("link",{name:"Đăng nhập"})).toHaveAttribute("href","/login");expect(screen.queryByRole("link",{name:"Dashboard"})).not.toBeInTheDocument();});
 it("labels sample figures without invented customer results",()=>{render(<LandingPage/>);expect(screen.getByText("06 ngành · 06 mẫu giao diện")).toBeInTheDocument();expect(screen.getByText(/Số liệu giả định để minh họa cách vận hành/)).toBeInTheDocument();expect(screen.queryByText(/300\+|100\+|95%/)).not.toBeInTheDocument();});
 it("offers a functional keyboard and pointer product preview",()=>{render(<LandingPage/>);fireEvent.click(screen.getByRole("tab",{name:"Sản xuất"}));expect(screen.getByRole("tab",{name:"Sản xuất"})).toHaveAttribute("aria-selected","true");expect(screen.getByRole("tabpanel")).toHaveTextContent("Lệnh gia công GC-024");fireEvent.keyDown(screen.getByRole("tab",{name:"Sản xuất"}),{key:"ArrowRight"});expect(screen.getByRole("tab",{name:"Dự án"})).toHaveAttribute("aria-selected","true");expect(screen.getByRole("tab",{name:"Dự án"})).toHaveFocus();});
});
