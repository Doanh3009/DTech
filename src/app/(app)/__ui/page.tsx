import { notFound } from "next/navigation";

import { UiPlayground } from "@/components/shared/UiPlayground";

export default function UiPlaygroundPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiPlayground />;
}
