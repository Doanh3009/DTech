import { PageHeader } from "@/components/shared/PageHeader";

export default async function Page({ params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;
  return <div className="page-stack"><PageHeader title="Ảnh chấm công" /><div className="attendance-photo-page">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="Ảnh chấm công" src={`/api/v1/attendance/photos/${photoId}`} />
  </div></div>;
}
