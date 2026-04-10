import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default async function DashboardLayout({ children }: {children: React.ReactNode}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={session.role as any} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={_session as any} />
        <main className="flex-1 overflow-y-auto p6">
          {children}
        </main>
      </div>
    </div>
  );
}
