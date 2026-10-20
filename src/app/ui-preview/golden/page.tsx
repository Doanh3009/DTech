import { notFound } from "next/navigation";

import { GoldenVisualPrototype } from "@/components/golden/GoldenVisualPrototype";

export default function GoldenVisualPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <GoldenVisualPrototype />;
}
