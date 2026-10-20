import { notFound } from "next/navigation";

import { UiPlayground } from "@/components/shared/UiPlayground";

export default function UiPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="page-main ui-preview-page"><UiPlayground /></main>;
}
