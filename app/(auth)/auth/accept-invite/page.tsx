"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite]    = useState<{ email: string; role: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError]   = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!token) { setInviteError("Missing invitation token"); setLoadingInvite(false); return; }
    fetch(`/api/auth/accept-invite?token=${token}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok) setInvite(j.data);
        else setInviteError(j.error ?? "Invalid invitation");
      })
      .catch(() => setInviteError("Network error"))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, firstName: firstName.trim(), lastName: lastName.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to accept invitation"); return; }
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 px-4">
      <div className="card w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-xl">A</div>
          <h1 className="text-2xl font-bold text-gray-900">Accept Invitation</h1>
        </div>

        {loadingInvite && <p className="text-center text-gray-500">Verifying invitation…</p>}

        {!loadingInvite && inviteError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
            {inviteError}
          </div>
        )}

        {!loadingInvite && invite && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              You've been invited as <strong>{invite.role.replace(/_/g, " ")}</strong> to join the platform.
            </p>
            <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-2 text-sm text-gray-700">
              {invite.email}
            </div>
            {error && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-base" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-base" placeholder="Min. 8 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input-base" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating account…" : "Create Account & Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
