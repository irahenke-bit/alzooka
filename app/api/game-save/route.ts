import { createAdminClient } from "@/lib/supabaseAdmin";
import { getServerClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// USER-SCOPED ROUTE - Game save
// Requires authentication + user_id must match logged-in user
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("user_id");
    
    if (!userId) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // GUARD: Require authenticated user and verify ownership
    const supabaseAuth = await getServerClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // GUARD: User can only save their own game data
    if (user.id !== userId) {
      return NextResponse.json(
        { error: "You can only save your own game data" },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("coin_collector_saves")
      .upsert({
        user_id: userId,
        coins: Math.floor(body.coins || 0),
        total_coins_earned: Math.floor(body.totalCoinsEarned || 0),
        clicks: Math.floor(body.clicks || 0),
        coins_per_click: Math.floor(body.coinsPerClick || 1),
        coins_per_second: Math.round((body.coinsPerSecond || 0) * 100) / 100,
        rebirth_count: Math.floor(body.rebirthCount || 0),
        rebirth_bonus: Math.round((body.rebirthBonus || 1) * 100) / 100,
        upgrades: body.upgrades || {},
        collectors: body.collectors || {},
        current_president: Math.floor(body.currentPresident || 1),
        highest_coins: Math.floor(body.highestCoins || 0),
        play_time_seconds: Math.floor(body.playTimeSeconds || 0),
      }, { onConflict: "user_id" });

    if (error) {
      console.error("Game save error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Game save error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
