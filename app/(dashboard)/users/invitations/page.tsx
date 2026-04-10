import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, ROLE_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/lib/permissions";
import { RevokeInviteButton } from "@/components/users/RevokeInviteButton";

export const metadata = { title: "Pending Invitations" };

export default async function InvitationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role as UserRole, "user:invite")) redirect("/users");

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId: session.role === "SUPER_ADMIN" ? undefined : session.orgId,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pending Invitations</h2>
          <p className="text-sm text-gray-500 mt-0.5">{invitations.length} pending</p>
        </div>
        <div className="flex gap-2">
          <Link href="/users?invite=1" className="btn-primary">+ Invite User</Link>
          <Link href="/users" className="btn-secondary">← Users</Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Expires</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Sent</th>
              <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invitations.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-medium text-gray-900">{inv.email}</td>
                <td className="px-6 py-3">
                  <span className="badge bg-gray-100 text-gray-700">
                    {ROLE_LABELS[inv.role as UserRole]}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-gray-500">
                  {inv.expiresAt < new Date()
                    ? <span className="text-red-500 font-medium">Expired</span>
                    : formatDate(inv.expiresAt)}
                </td>
                <td className="px-6 py-3 text-xs text-gray-400">{formatDate(inv.createdAt)}</td>
                <td className="px-6 py-3 text-right">
                  <RevokeInviteButton inviteId={inv.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invitations.length === 0 && (
          <div className="py-12 text-center text-gray-500">No pending invitations</div>
        )}
      </div>
    </div>
  );
}
