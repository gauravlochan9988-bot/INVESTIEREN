import { NextResponse } from "next/server";
import { getRailwayApiBaseUrl } from "@/lib/railway";

export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({ code: "" }))) as {
    code?: string;
  };

  const upstream = await fetch(`${getRailwayApiBaseUrl()}/api/auth/access-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: String(code || "").trim() }),
    cache: "no-store",
  });

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : typeof payload?.error === "string"
          ? payload.error
          : "Invalid access code.";
    return NextResponse.json({ detail }, { status: upstream.status });
  }

  const response = NextResponse.json({ ok: true, isAdmin: true });
  response.cookies.set("investieren_admin_session", payload.session_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("investieren_admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
