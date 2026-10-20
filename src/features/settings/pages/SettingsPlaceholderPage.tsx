import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/shared/Button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/FilterBar";
import { Input, SearchInput, Select, Switch } from "@/components/shared/FormControls";
import { FormSection, StickyActionBar } from "@/components/shared/FormLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { SettingsShell } from "@/features/settings/components/SettingsShell";

type SettingsPath =
  | "/settings/users"
  | "/settings/organization"
  | "/settings/attendance"
  | "/settings/roles"
  | "/settings/approval-workflows"
  | "/settings/export-templates"
  | "/settings/integrations"
  | "/settings/audit-log";

interface SettingsPlaceholderPageProps {
  activePath: SettingsPath;
  title: string;
  description: string;
  listPattern?: boolean;
}

interface SettingsRow {
  key: string;
  scope: string;
  status: string;
}

const columns: DataTableColumn<SettingsRow>[] = [
  { id: "key", header: "Khóa", accessor: "key", sortable: true },
  { id: "scope", header: "Phạm vi", accessor: "scope", hiddenOnMobile: true },
  { id: "status", header: "Trạng thái", accessor: "status" }
];

export function SettingsPlaceholderPage({
  activePath,
  title,
  description,
  listPattern = false
}: SettingsPlaceholderPageProps) {
  return (
    <SettingsShell activePath={activePath}>
      <div className="page-stack">
        <PageHeader
          action={
            <Button leftIcon={<SlidersHorizontal aria-hidden="true" size={16} />} variant="primary">
              Cấu hình
            </Button>
          }
          description={description}
          title={title}
        />
        {listPattern ? (
          <>
            <form action={activePath} method="get">
              <FilterBar>
                <SearchInput name="q" placeholder="Tìm cấu hình" />
                <Select
                  label="Phạm vi"
                  name="scope"
                  options={[
                    { label: "Toàn hệ thống", value: "global" },
                    { label: "Theo module", value: "module" },
                    { label: "Theo người dùng", value: "user" }
                  ]}
                  placeholder="Tất cả"
                />
              </FilterBar>
            </form>
            <DataTable
              columns={columns}
              data={[]}
              emptyDescription="Dữ liệu cấu hình sẽ hiển thị theo quyền quản trị."
              emptyTitle="Chưa có dữ liệu cấu hình"
            />
            <Pagination page={1} pageCount={1} />
          </>
        ) : (
          <section className="settings-form-card">
            <FormSection
              description="Thông tin hiển thị trong hệ thống và tài liệu xuất nội bộ."
              title="Thông tin nền tảng"
            >
              <Input helperText="Tên hiển thị trong header và tài liệu xuất." label="Tên tổ chức" />
              <Select
                helperText="Timestamp nghiệp vụ hiển thị theo timezone công ty."
                label="Timezone"
                options={[{ label: "Việt Nam (Asia/Ho_Chi_Minh)", value: "Asia/Ho_Chi_Minh" }]}
              />
              <Input helperText="Dùng cho API, webhook và link nội bộ." label="Base URL" />
              <Switch checked label="Bật audit log" helperText="Ghi nhận thao tác quan trọng của người dùng." />
            </FormSection>
            <StickyActionBar>
              <Button variant="secondary">Hủy</Button>
              <Button variant="primary">Lưu thay đổi</Button>
            </StickyActionBar>
          </section>
        )}
      </div>
    </SettingsShell>
  );
}
