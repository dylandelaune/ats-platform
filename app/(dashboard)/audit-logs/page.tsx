import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/lib/permissions";

export const metadata = { title: "Audit Log" };

const ACTION_COLORS: Record<string, string> = {
  AUTH_LOGIN:          "bg-green-100 text-green-700",
  AUTH_LOGOUT:         "bg-gray-100 text-gray-600",
  AUTH_LOGIN_FAILED:   "bg-red-100 text-red-700",
  AUTH_MFA_ENABLED:    "bg-blue-100 text-blue-700",
  AUTH_MFA_DISABLED:   "bg-orange-100 text-orange-700",
  USER_INVITED:        "bg-purple-100 text-purple-700",
  USER_DEACTIVATED:    "bg-red-100 text-red-700",
  USER_REACTIVATED:    "bg-green-100 text-green-700",
  USER_ROLE_CHANGED:   "bg-yellow-100 text-yellow-700",
  ORG_CREATED:         "bg-blue-100 text-blue-700",
  DEFAULT:             "bg-gray-100 text-gray-600",
};

function actionColor(action: string) {
  return ACTION_COLORS[action] ?? ACTION_COLORS.DEFAULT;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { page?: string; action?: string; userId?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role as UserRole, "audit:read")) redirect("/dashboard");

  const page   = Math.max(1, parseInt(searchParams.page ?? "1"));
  const limit  = 50;
  const action = searchParams.action ?? undefined;
  const userId = searchParams.userId ?? undefined;

  const orgId = session.role === "SUPER_ADMIN" ? undefined : session.orgId;

  const where = {
    ...(orgId  ? { organizationId: orgId } : {}),
    ...(action ? { action: action as never } : {}),
    ...(userId ? { actorId: userId } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} events recorded</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-2 flex-wrap">
        <select name="action" defaultValue={action ?? ""} className="input-base w-auto">
          <option value="">All actions</option>
          <optgroup label="Auth">
            {["AUTH_LOGIN","AUTH_LOGOUT","AUTH_LOGIN_FAILED","AUTH_MFA_ENABLED","AUTH_MFA_DISABLED"].map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
            ))}
          </optgroup>
          <optgroup label="Users">
            {["USER_CREATED","USER_UPDATED","USER_DEACTIVATED","USER_REACTIVATED","USER_ROLE_CHANGED","USER_INVITED"].map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
            ))}
          </optgroup>
          <optgroup label="Orgs">
            {["ORG_CREATED","ORG_UPDATED","ORG_DEACTIVATED"].map((a) => (
              <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
            ))}
          </optgroup>
        </select>
        <button type="submit" className="btn-secondary">Filter</button>
        {(action || userId) && <Link href="/audit-logs" className="btn-secondary">Clear</Link>}
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500">When</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Actor</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Action</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">Target</th>
              {session.role === "SUPER_ADMIN" && (
                <th className="px-6 py-3 text-left font-medium text-gray-500">Org</th>
              )}
              <th className="px-6 py-3 text-left font-medium text-gray-500">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {formatDate(log.createdAt)}
                </td>
                <td className="px-6 py-3">
                  {log.actor ? (
                    <div>
                      <p className="font-medium text-gray-900 text-xs">
                        {log.actor.firstName} {log.actor.lastName}
                      </p>
                      <p className="text-gray-400 text-xs">{log.actor.email}</p>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">System</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  <span className={`badge text-xs ${actionColor(log.action)}`}>
                    {log.action.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-gray-500">
                  {log.targetUser
                    ? `${log.targetUser.firstName} ${log.targetUser.lastName}`
                    : log.resourceType && log.resourceId
                      ? `${log.resourceType} ${log.resourceId.slice(0, 8)}…`
                      : "—"}
                </td>
                {session.role === "SUPER_ADMIN" && (
                  <td className="px-6 py-3 text-xs text-gray-400">
                    {log.organization?.name ?? "—"}
                  </td>
                )}
                <td className="px-6 py-3 text-xs text-gray-400 font-mono">
                  {log.ipAddress ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="py-12 text-center text-gray-500">No audit events found</div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>Page {page} of {pages} · {total} total</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/audit-logs?page=${page - 1}&action=${action ?? ""}`} className="btn-secondary">← Prev</Link>
            )}
            {page < pages && (
              <Link href={`/audit-logs?page=${page + 1}&action=${action ?? ""}`} className="btn-secondary">Next →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
