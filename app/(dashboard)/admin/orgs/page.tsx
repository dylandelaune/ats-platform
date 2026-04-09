import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "A/lib/db";
import { formatDate } from "@/lib/utils";
import { CreateOrgForm } from "A/components/orgs/CreateOrgForm";

export const metadata = { title: "Organizations" };

export default async function OrgsPage({ searchParams }: { searchParams: { create?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_ADMIN") redirect("/dashboard");

  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
          <p className="text-sm text-gray-500 mt-0.5">{orgs.length} organizations</p>
        </div>
        <a href="/admin/orgs?create=1" className="btn-primary">+ New Organization</a>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Slug</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Domain</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Users</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-900">{org.name}</td>
                <td className="px-6 py-3 text-gray-500 font-mono text-xs">{org.slug}</td>
                <td className="px-6 py-3 text-gray-500">{org.domain ?? "—"}</td>
                <td className="px-6 py-3 text-gray-700">{org._count.users}</td>
                <td className="px-6 py-3">
                  {org.isActive
                    ? <span className="badge bg-green-100 text-green-700">Active</span>
                    : <span className="badge bg-red-100 text-red-600">Inactive</span>}
                </td>
                <td className="px-6 py-3 text-gray-400 text-xs">{formatDate(org.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && (
          <div className="py-12 text-center text-gray-500">No organizations yet</div>
        )}
      </div>

      {searchParams.create === "1" && <CreateOrgForm />}
    </div>
  );
}
