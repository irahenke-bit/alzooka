import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const isSignup = requestUrl.searchParams.get("signup") === "true";

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
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore errors in middleware
            }
          },
        },
      }
    );

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
    } else if (isSignup) {
      // This is a signup - create profile automatically
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name;
      const emailPrefix = user.email?.split("@")[0] || "user";
      let baseUsername = googleName 
        ? googleName.toLowerCase().replace(/[^a-z0-9_]/g, "_").substring(0, 20)
        : emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, "_").substring(0, 20);
      
      // Make username unique
      let username = baseUsername;
      let attempt = 0;
      while (attempt < 100) {
        const { data: existing } = await supabase
          .from("users")
          .select("username")
          .eq("username", username)
          .single();
        
        if (!existing) break;
        attempt++;
        username = `${baseUsername}${attempt}`;
      }
      
      // Create the profile
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          username: username,
          display_name: googleName || emailPrefix,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          terms_accepted_at: new Date().toISOString(),
        });
      
      if (insertError) {
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(insertError.message)}`, requestUrl.origin)
        );
      }
      
      // Success - go to feed
      return NextResponse.redirect(new URL("/", requestUrl.origin));
    } else {
      // No profile and not a signup, show the message
      return NextResponse.redirect(
        new URL(`/auth/no-profile?email=${encodeURIComponent(user.email || "")}`, requestUrl.origin)
      );
    }
  }

  // No code, go to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
