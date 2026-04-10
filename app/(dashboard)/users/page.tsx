import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/lib/permissions";
import { InviteUserModal } from "@/components/users/InviteUserModal";
import { UserActionButtons } from "@/components/users/UserActionButtons";

export const metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string; invite?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role as UserRole, "user:list")) redirect("/dashboard");

  const page   = Math.max(1, parseInt(searchParams.page ?? "1"));
  const search = searchParams.search ?? "";
  const limit  = 25;

  const where = {
    organizationId: session.role === "SUPER_ADMIN" ? undefined : session.orgId,
    ...(search ? {
      OR: [
        { email:     { contains: search, mode: "insensitive" as const } },
        { firstName: { contains: search, mode: "insensitive" as const } },
        { lastName:  { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [users, total, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, mfaEnabled: true, lastLoginAt: true, createdAt: true,
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
    hasPermission(session.role as UserRole, "user:invite")
      ? prisma.invitation.count({ where: { organizationId: session.orgId, status: "PENDING" } })
      : Promise.resolve(0),
  ]);

  const pages = Math.ceil(total / limit);
  const canInvite = hasPermission(session.role as UserRole, "user:invite");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} total · {pendingInvites} pending invitations</p>
        </div>
        {canInvite && (
          <div className="flex gap-2">
            <Link href="/users?invite=1" className="btn-primary">
              + Invite User
            </Link>
            <Link href="/users/invitations" className="btn-secondary text-sm">
              Invitations
            </Link>
          </div>
        )}
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="input-base max-w-sm"
        />
        <button type="submit" className="btn-secondary">Search</button>
        {search && <Link href="/users" className="btn-secondary">Clear</Link>}
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">MFA</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Last Login</th>
              {canInvite && <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                    <p className="text-gray-500 text-xs">{u.email}</p>
                    {session.role === "SUPER_ADMIN" && (
                      <p className="text-gray-400 text-xs">{u.organization.name}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <span className={`badge ${ROLE_COLORS[u.role as UserRole]}`}>
                    {ROLE_LABELS[u.role as UserRole]}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {u.mfaEnabled
                    ? <span className="badge bg-green-100 text-green-700">Enabled</span>
                    : <span className="badge bg-gray-100 text-gray-500">Off</span>}
                </td>
                <td className="px-6 py-3">
                  {u.isActive
                    ? <span className="badge bg-green-100 text-green-700">Active</span>
                    : <span className="badge bg-red-100 text-red-600">Inactive</span>}
                </td>
                <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {formatDate(u.lastLoginAt)}
                </td>
                {canInvite && (
                  <td className="px-6 py-3 text-right">
                    <UserActionButtons
                      userId={u.id}
                      isActive={u.isActive}
                      currentUserRole={session.role as UserRole}
                      currentUserId={session.sub}
                      targetRole={u.role as UserRole}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <p className="text-4xl mb-2">👥</p>
            <p>No users found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>Page {page} of {pages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/users?page=${page - 1}&search=${search}`} className="btn-secondary">← Prev</Link>
            )}
            {page < pages && (
              <Link href={`/users?page=${page + 1}&search=${search}`} className="btn-secondary">Next →</Link>
            )}
          </div>
        </div>
      )}

      {/* Invite modal (controlled by ?invite=1) */}
      {searchParams.invite === "1" && canInvite && (
        <InviteUserModal role={session.role as UserRole} />
      )}
    </div>
  );
}
