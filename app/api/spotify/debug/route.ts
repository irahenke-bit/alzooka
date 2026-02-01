import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";

// Debug endpoint to check Spotify token status
export async function GET() {
  // Get all cookies for debugging
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieNames = allCookies.map(c => c.name);
  
  // Get auth cookies specifically
  const authCookies: Record<string, string> = {};
  for (const cookie of allCookies) {
    if (cookie.name.includes('auth') || cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
      authCookies[cookie.name] = cookie.value.slice(0, 50) + '...';
    }
  }
  
  // Use the proper server client with cookie handling
  const testSupabase = await createServerClient();
  
  // Get current user from session
  const { data: { user: currentUser } } = await testSupabase.auth.getUser();
  const { data: anyUser } = await testSupabase
    .from("users")
    .select("id, spotify_refresh_token")
    .not("spotify_refresh_token", "is", null)
    .limit(1);
  
  // Also check the specific user we know about
  const knownUserId = "5aa34cc1-ed8e-4b31-9b88-12ffe6de250a";
  const { data: knownUser, error: knownUserError } = await testSupabase
    .from("users")
    .select("id, spotify_access_token, spotify_refresh_token, spotify_token_expires_at, spotify_user_id")
    .eq("id", knownUserId)
    .single();

  // Test if we can update this user's spotify fields
  const { error: testUpdateError } = await testSupabase
    .from("users")
    .update({ spotify_user_id: "test_update_works" })
    .eq("id", knownUserId);

  // Read back to see if update worked
  const { data: afterUpdate } = await testSupabase
    .from("users")
    .select("spotify_user_id")
    .eq("id", knownUserId)
    .single();

  // Clean up the test
  await testSupabase
    .from("users")
    .update({ spotify_user_id: null })
    .eq("id", knownUserId);

  return NextResponse.json({
    cookieNames,
    authCookies,
    currentUser: currentUser ? { id: currentUser.id, email: currentUser.email } : null,
    anyUserWithSpotify: anyUser && anyUser.length > 0 ? anyUser[0].id : null,
    knownUser: {
      id: knownUser?.id,
      hasAccessToken: !!knownUser?.spotify_access_token,
      hasRefreshToken: !!knownUser?.spotify_refresh_token,
      spotifyUserId: knownUser?.spotify_user_id,
      error: knownUserError?.message,
    },
    testUpdate: {
      error: testUpdateError?.message || null,
      valueAfterUpdate: afterUpdate?.spotify_user_id,
      updateWorked: afterUpdate?.spotify_user_id === "test_update_works",
    }
  });
}

