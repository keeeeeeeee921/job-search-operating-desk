"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
  evaluateAccess,
  sanitizeNextPath
} from "@/lib/access-token";

export async function loginWithAccessToken(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const nextPath = sanitizeNextPath(formData.get("next"));
  const decision = evaluateAccess(token);

  if (!decision.allowed) {
    const params = new URLSearchParams({ error: decision.reason });
    if (nextPath !== "/") {
      params.set("next", nextPath);
    }
    redirect(`/login?${params.toString()}`);
  }

  if (decision.reason === "token_match") {
    const store = await cookies();
    store.set({
      name: ACCESS_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS
    });
  }

  redirect(nextPath);
}
