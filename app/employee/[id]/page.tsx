import ProfilePage from "@/components/pages/ProfilePage";
export const metadata = { title: "SHIFT employee profile" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfilePage id={Number(id)} />;
}
