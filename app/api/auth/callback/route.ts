import { getServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await getServerClient();

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      // Auth failed
      return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
    }

    const user = data.user;

    // Check if user has a profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profile) {
      // Profile exists, go to home
      return NextResponse.redirect(new URL("/", requestUrl.origin));
    } else {
      // No profile - send to complete-profile to create one
      return NextResponse.redirect(new URL("/auth/complete-profile", requestUrl.origin));
    }
  }

  // No code, go to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
