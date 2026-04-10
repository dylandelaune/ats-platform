import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, ROLE_COLORS, canViewAuditLog } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/lib/permissions";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, userCount, orgCount, recentLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, mfaEnabled: true, lastLoginAt: true,
                organization: { select: { name: true, createdAt: true } } },
    }),
    prisma.user.count({ where: { organizationId: session.orgId } }),
    session.role === "SUPER_ADMIN" ? prisma.organization.count() : Promise.resolve(null),
    canViewAuditLog(session.role as UserRole)
      ? prisma.auditLog.findMany({
          where: { organizationId: session.orgId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { actor: { select: { firstName: true, lastName: true, email: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!user) redirect("/login");

  const stats = [
    { label: "Users in org",  value: userCount,  icon: "👥" },
    ...(orgCount !== null ? [{ label: "Total orgs",  value: orgCount, icon: "🏢" }] : []),
    { label: "MFA Status", value: user.mfaEnabled ? "Enabled" : "Disabled", icon: user.mfaEnabled ? "🔐" : "⚠️" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {user.firstName}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {user.organization.name} ·{" "}
          <span className={`badge ${ROLE_COLORS[user.role as UserRole]}`}>
            {ROLE_LABELS[user.role as UserRole]}
          </span>
        </p>
      </div>

      {/* MFA warning */}
      {!user.mfaEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <span className="text-amber-500 text-xl">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800">Two-factor authentication is not enabled</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Secure your account by enabling MFA in your account settings.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{s.label}</p>
              <span className="text-xl">{s.icon}</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      {recentLogs.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {recentLogs.map((log) => (
              <li key={log.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">
                      {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System"}
                    </span>{" "}
                    <span className="text-gray-500">{log.action.replace(/_/g, " ").toLowerCase()}</span>
                  </p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{formatDate(log.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
