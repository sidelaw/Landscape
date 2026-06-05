import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** POST /auth/signout — clears the Supabase session and returns to /login. */
export async function POST(req: Request) {
  const supabase = createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
