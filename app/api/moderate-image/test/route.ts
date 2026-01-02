import { NextResponse } from 'next/server';

/**
 * Test endpoint to verify content moderation is configured correctly.
 * 
 * GET /api/moderate-image/test
 * 
 * Returns status of the moderation system without needing to upload anything.
 */

export async function GET() {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({
      status: 'NOT_CONFIGURED',
      message: 'Google Cloud API key is not set. Content moderation is NOT active.',
      protected: false,
    }, { status: 503 });
  }

  // Test the API with a simple request to verify credentials work
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: {
              // Tiny 1x1 transparent PNG (base64)
              content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
            },
            features: [{ type: 'SAFE_SEARCH_DETECTION' }]
          }]
        })
      }
    );

    if (response.ok) {
      return NextResponse.json({
        status: 'ACTIVE',
        message: 'Content moderation is working! All image uploads are being scanned.',
        protected: true,
        apiKeyPrefix: apiKey.substring(0, 10) + '...',
      });
    } else {
      const error = await response.text();
      return NextResponse.json({
        status: 'API_ERROR',
        message: 'Google Vision API returned an error. Check your API key.',
        protected: false,
        error: error.substring(0, 200),
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'CONNECTION_ERROR',
      message: 'Could not connect to Google Vision API.',
      protected: false,
      error: String(error),
    }, { status: 500 });
  }
}

// Trigger rebuild Fri Jan  2 14:25:54 EST 2026
