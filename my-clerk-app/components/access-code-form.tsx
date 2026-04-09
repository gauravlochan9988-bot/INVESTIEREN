"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCESS_STORAGE_KEY = "gq_trading_access";
const ACCESS_CODE = "9988";

export function AccessCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (code.trim() !== ACCESS_CODE) {
        throw new Error("Invalid access code");
      }

      window.localStorage.setItem(ACCESS_STORAGE_KEY, "granted");
      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Invalid access code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="access-code-form" onSubmit={onSubmit}>
      <label className="access-code-label" htmlFor="access-code">Access code</label>
      <input
        id="access-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="access-code-input"
        type="password"
        placeholder="Enter access code"
        autoComplete="current-password"
      />
      <button className="access-code-button" type="submit" disabled={loading}>
        {loading ? "Checking..." : "Unlock Dashboard"}
      </button>
      {error ? <p className="access-code-error">{error}</p> : null}
    </form>
  );
}
