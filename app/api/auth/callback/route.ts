import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      // Auth failed
      return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
    }

    // Check if user has a profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("id", data.user.id)
      .single();

    if (profile) {
      // Profile exists, go to home
      return NextResponse.redirect(new URL("/", requestUrl.origin));
    } else {
      // No profile, show the message
      return NextResponse.redirect(
        new URL(`/auth/no-profile?email=${encodeURIComponent(data.user.email || "")}`, requestUrl.origin)
      );
    }
  }

  // No code, go to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
