import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  const { id: userId, groupId } = await params;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
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
  const body = await request.json();
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
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
