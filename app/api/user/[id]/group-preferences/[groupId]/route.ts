import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// USER-SCOPED ROUTE - Group preferences
// Requires authentication + userId path must match logged-in user
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const { id: userId, groupId } = await params;

  // GUARD: Require authenticated user and verify ownership
  const supabaseAuth = await createServerClient();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // GUARD: User can only access their own preferences
  if (user.id !== userId) {
    return NextResponse.json(
      { error: "You can only access your own preferences" },
      { status: 403 }
    );
  }
  
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from("user_group_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .single();
  
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Return defaults if no preferences exist
  if (!data) {
    return NextResponse.json({
      user_id: userId,
      group_id: groupId,
      include_in_feed: false,
      max_posts_per_day: 3,
      whitelist_members: [],
      mute_members: [],
      friends_only: false,
    });
  }
  
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const { id: userId, groupId } = await params;

  // GUARD: Require authenticated user and verify ownership
  const supabaseAuth = await createServerClient();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // GUARD: User can only update their own preferences
  if (user.id !== userId) {
    return NextResponse.json(
      { error: "You can only update your own preferences" },
      { status: 403 }
    );
  }

  const body = await request.json();
  
  const supabase = createAdminClient();
  
  // Upsert preferences
  const { data, error } = await supabase
    .from("user_group_preferences")
    .upsert({
      user_id: userId,
      group_id: groupId,
      include_in_feed: body.include_in_feed ?? false,
      max_posts_per_day: body.max_posts_per_day ?? 3,
      whitelist_members: body.whitelist_members ?? [],
      mute_members: body.mute_members ?? [],
      friends_only: body.friends_only ?? false,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,group_id",
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}
