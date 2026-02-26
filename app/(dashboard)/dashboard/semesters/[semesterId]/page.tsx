import { SemesterDetailPage } from "@/components/dashboard/semester-detail-page";

type Props = {
  params: Promise<{ semesterId: string }>;
};

export default async function SemesterPage({ params }: Props) {
  const { semesterId } = await params;
  return <SemesterDetailPage semesterId={semesterId} />;
}
