import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Exchange the code for a session
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !user) {
      // Auth failed, redirect to login
      return NextResponse.redirect(new URL("/login", requestUrl.origin));
    }

    // Check if user has a profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profile) {
      // Profile exists, redirect to home
      return NextResponse.redirect(new URL("/", requestUrl.origin));
    } else {
      // No profile, redirect to the no-profile page with email
      const noProfileUrl = new URL("/auth/no-profile", requestUrl.origin);
      noProfileUrl.searchParams.set("email", user.email || "");
      return NextResponse.redirect(noProfileUrl);
    }
  }

  // No code, redirect to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
