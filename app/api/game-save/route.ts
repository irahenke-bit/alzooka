import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("user_id");
    
    if (!userId) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const body = await request.json();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from("coin_collector_saves")
      .upsert({
        user_id: userId,
        coins: Math.floor(body.coins || 0),
        total_coins_earned: Math.floor(body.totalCoinsEarned || 0),
        clicks: Math.floor(body.clicks || 0),
        coins_per_click: Math.floor(body.coinsPerClick || 1),
        coins_per_second: body.coinsPerSecond || 0,
        rebirth_count: body.rebirthCount || 0,
        rebirth_bonus: body.rebirthBonus || 1,
        upgrades: body.upgrades || {},
        collectors: body.collectors || {},
        current_president: body.currentPresident || 1,
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
