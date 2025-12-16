import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.error("YOUTUBE_API_KEY is not set");
    return NextResponse.json({ error: "YouTube API not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
        new URLSearchParams({
          part: "snippet",
          q: query,
          type: "video",
          maxResults: "10",
          key: apiKey,
        })
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("YouTube API error:", error);
      return NextResponse.json({ error: "YouTube API error" }, { status: response.status });
    }

    const data = await response.json();

    // Transform the response to a simpler format
    const videos = data.items.map((item: {
      id: { videoId: string };
      snippet: {
        title: string;
        channelTitle: string;
        thumbnails: { medium: { url: string } };
        description: string;
      };
    }) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
      description: item.snippet.description,
    }));

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json({ error: "Failed to search YouTube" }, { status: 500 });
  }
}
