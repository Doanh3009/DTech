"use client";

import { useState } from "react";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { MetricCard } from "@/components/shared/DashboardCards";
import { Worklist, type DataTableColumn } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import {
  Checkbox,
  DatePicker,
  Input,
  Radio,
  SearchInput,
  Select,
  Switch,
  Textarea
} from "@/components/shared/FormControls";
import { FormErrorSummary, FieldGroup, StickyActionBar } from "@/components/shared/FormLayout";
import { EntityContextHeader, ResponsivePageHeader } from "@/components/shared/PageHeader";
import { DataSurface, PageContainer, Section, SectionHeader } from "@/components/shared/PageLayouts";
import { Skeleton } from "@/components/shared/States";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ContextTabs } from "@/components/shared/Tabs";
import { FunctionToolbar } from "@/components/shared/ActionBars";
import { UploadPreview } from "@/components/shared/Uploads";

const tones = ["blue", "mint", "lavender", "orange", "yellow", "cyan", "rose"] as const;
const rows = [
  { id: "1", code: "NV001", name: "Nguyễn Minh Anh", status: "active" },
  { id: "2", code: "NV002", name: "Trần Quốc Bảo", status: "pending" }
];
const columns: DataTableColumn<(typeof rows)[number]>[] = [
  { id: "code", header: "Mã", accessor: "code" },
  { id: "name", header: "Nhân viên", accessor: "name" },
  { id: "status", header: "Trạng thái", cell: (row) => <StatusBadge tone={row.status === "active" ? "success" : "warning"}>{row.status === "active" ? "Hoạt động" : "Chờ xử lý"}</StatusBadge> }
];

export function UiPlayground() {
  const [autoApprove, setAutoApprove] = useState(true);

  return (
    <PageContainer>
      <ResponsivePageHeader title="Hệ thống giao diện" />
      <EntityContextHeader
        action={<Button variant="secondary">Thông tin gói</Button>}
        code="CT-ERP-01"
        meta="Cảng ABC · Nguyễn Văn Cường · 12 nhân sự"
        status={<StatusBadge tone="success">Đang thi công</StatusBadge>}
        title="Bảo trì hệ thống ray"
      />
      <ContextTabs
        items={[
          { active: true, href: "#construction", label: "Thi công" },
          { href: "#attendance", label: "Chấm công" },
          { href: "#records", label: "Hồ sơ" },
          { href: "#documents", label: "Tài liệu" }
        ]}
        label="Không gian làm việc mẫu"
      />
      <FunctionToolbar>
        <Button variant="secondary">Xuất dữ liệu</Button>
        <Button variant="primary">Tạo mới</Button>
      </FunctionToolbar>
      <Section>
        <SectionHeader title="Màu và card" />
        <div className="ui-playground-grid">
          {tones.map((tone) => <Card key={tone} variant={tone}><strong>{tone}</strong></Card>)}
        </div>
      </Section>
      <Section>
        <SectionHeader title="Chỉ số vận hành" />
        <dl className="dashboard-overview__grid">
          <MetricCard accent="amber"><dt>Chờ xử lý</dt><dd>12</dd><span className="dashboard-overview__note">Kho hàng</span></MetricCard>
          <MetricCard accent="purple"><dt>Dự án</dt><dd>24</dd><span className="dashboard-overview__note">Đang triển khai</span></MetricCard>
          <MetricCard accent="teal"><dt>Chấm công</dt><dd>96%</dd><span className="dashboard-overview__note">Hôm nay</span></MetricCard>
          <MetricCard accent="green"><dt>Nhân sự</dt><dd>186</dd><span className="dashboard-overview__note">Đang làm việc</span></MetricCard>
        </dl>
      </Section>
      <Section>
        <SectionHeader title="Button và trạng thái" />
        <div className="ui-playground-row">
          <Button variant="primary">Primary</Button><Button variant="secondary">Secondary</Button>
          <Button variant="soft">Soft</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button>
          <StatusBadge tone="success">Hoạt động</StatusBadge><StatusBadge tone="warning">Chờ xử lý</StatusBadge>
          <StatusBadge tone="error">Quá hạn</StatusBadge><StatusBadge tone="info">Thông tin</StatusBadge>
        </div>
      </Section>
      <form className="erp-form-preview" onSubmit={(event) => event.preventDefault()}>
        <FormErrorSummary
          errors={[{ fieldId: "erp-counterparty", message: "Chọn đối tượng giao dịch" }]}
        />
        <FieldGroup title="Thông tin chứng từ">
          <Input defaultValue="CT-2026-00128" label="Mã chứng từ" readOnly />
          <DatePicker defaultValue="2026-09-19" label="Ngày chứng từ" required />
          <Input
            error="Chọn đối tượng giao dịch"
            id="erp-counterparty"
            label="Đối tượng"
            placeholder="Nhập mã hoặc tên đối tượng"
            required
          />
          <Select
            label="Đơn vị thực hiện"
            options={[
              { label: "Khối vận hành", value: "operations" },
              { label: "Khối tài chính", value: "finance" }
            ]}
            placeholder="Chọn đơn vị"
          />
          <Input defaultValue="12500000" label="Giá trị" min="0" step="1000" type="number" />
          <Input defaultValue="VND" disabled label="Loại tiền" />
          <Textarea label="Nội dung" placeholder="Nhập nội dung chứng từ" rows={4} />
          <div className="erp-choice-group">
            <span className="erp-choice-group__label">Phương thức xử lý</span>
            <div className="erp-choice-group__items">
              <Radio defaultChecked label="Xử lý ngay" name="processing-mode" value="now" />
              <Radio label="Lưu nháp" name="processing-mode" value="draft" />
            </div>
          </div>
          <div className="erp-choice-group">
            <Checkbox defaultChecked label="Gửi thông báo" />
            <Switch checked={autoApprove} label="Tự động duyệt" onCheckedChange={setAutoApprove} />
          </div>
        </FieldGroup>
        <StickyActionBar>
          <Button variant="secondary">Hủy</Button>
          <Button variant="soft">Lưu nháp</Button>
          <Button type="submit" variant="primary">Lưu chứng từ</Button>
        </StickyActionBar>
      </form>
      <DataSurface>
        <header className="data-surface__toolbar"><h2>Danh sách bản ghi</h2></header>
        <FilterBar
          actions={<><Button variant="secondary">Xuất dữ liệu</Button><Button variant="primary">Tạo mới</Button></>}
        >
          <SearchInput label="Tìm bản ghi" placeholder="Tìm mã, tên" />
          <Select
            label="Trạng thái"
            labelHidden
            options={[{ label: "Đang hoạt động", value: "active" }]}
            placeholder="Tất cả trạng thái"
          />
        </FilterBar>
        <Worklist columns={columns} data={rows} getRowId={(row) => row.id} />
      </DataSurface>
      <Section>
        <SectionHeader title="Tệp tải lên" />
        <UploadPreview meta="248 KB" name="bien-ban-nghiem-thu.pdf" />
      </Section>
      <Section><SectionHeader title="Loading" /><Card><Skeleton /></Card></Section>
    </PageContainer>
  );
}
