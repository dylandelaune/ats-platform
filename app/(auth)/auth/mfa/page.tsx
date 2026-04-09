"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function MFAPage() {
  const router = useRouter();
  const [code,     setCode]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [mode,     setMode]     = useState<"verify" | "setup">("verify");
  const [qrCode,   setQrCode]   = useState<string | null>(null);
  const [secret,   setSecret]   = useState<string | null>(null);

  // Check if this is a setup flow or verify flow by checking the user profile
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.data && !j.data.mfaEnabled) {
          setMode("setup");
          initSetup();
        }
      })
      .catch(() => {});
  }, []);

  async function initSetup() {
    const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
    const json = await res.json();
    if (json.data) {
      setQrCode(json.data.qrCode);
      setSecret(json.data.secret);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Invalid code");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-blue-100 px-4">
      <div className="card w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white text-2xl">
            🔐
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "setup" ? "Set Up Two-Factor Auth" : "Two-Factor Authentication"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {mode === "setup"
              ? "Scan the QR code with your authenticator app"
              : "Enter the 6-digit code from your authenticator app"}
          </p>
        </div>

        {mode === "setup" && qrCode && (
          <div className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 rounded-lg border border-gray-200" />
            </div>
            {secret && (
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs text-gray-500 mb-1">Manual entry key:</p>
                <p className="font-mono text-sm text-gray-800 break-all select-all">{secret}</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="input-base text-center text-xl tracking-widest font-mono"
              placeholder="000000"
              autoFocus
            />
          </div>

          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full">
            {loading ? "Verifying…" : mode === "setup" ? "Enable MFA" : "Verify & Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Compatible with Google Authenticator, Authy, and 1Password
        </p>
      </div>
    </div>
  );
}
