import { createAnonServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Health check endpoint - ping this daily to keep Supabase active
// Use a free cron service like cron-job.org to hit: https://alzooka.com/api/health

export async function GET() {
  try {
    const supabase = createAnonServerClient();

    // Simple query to keep the database active
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { status: "error", message: error.message, timestamp: new Date().toISOString() },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      profiles_count: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Failed to connect to database", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
