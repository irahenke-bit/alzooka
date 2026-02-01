import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { analyzeModeration, ModerationResult } from '@/lib/imageModeration';

/**
 * Image Moderation API Endpoint
 * 
 * Uses Google Cloud Vision API SafeSearch to detect inappropriate content.
 * 
 * REQUIRED ENV VARS:
 * - GOOGLE_CLOUD_API_KEY: Your Google Cloud Vision API key
 * 
 * Usage:
 * POST /api/moderate-image
 * Body: { imageUrl: string } OR { imageBase64: string }
 */

const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

interface SafeSearchAnnotation {
  adult: string;
  violence: string;
  racy: string;
  medical: string;
  spoof: string;
}

interface VisionAPIResponse {
  responses: Array<{
    safeSearchAnnotation?: SafeSearchAnnotation;
    error?: {
      code: number;
      message: string;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Temporarily hardcoded to bypass Vercel env var issue
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY || 'AIzaSyBnaf97Z6Mg9ma9w503-6F2qkSCfcawHOU';
    
    if (!apiKey) {
      console.error('GOOGLE_CLOUD_API_KEY not configured');
      // FAIL CLOSED: If moderation is not configured, block all uploads
      return NextResponse.json(
        { 
          safe: false, 
          blocked: true, 
          error: 'Content moderation is not configured. Please contact the administrator.',
          categories: {
            adult: 'UNKNOWN',
            violence: 'UNKNOWN',
            racy: 'UNKNOWN',
            medical: 'UNKNOWN',
            spoof: 'UNKNOWN',
          }
        } as ModerationResult,
        { status: 503 }
      );
    }

    const body = await request.json();
    const { imageUrl, imageBase64 } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: 'Either imageUrl or imageBase64 is required' },
        { status: 400 }
      );
    }

    // Build the request for Google Vision API
    let imageContent: { source?: { imageUri: string }; content?: string };
    
    if (imageBase64) {
      // Direct base64 content (preferred - scan before storage)
      imageContent = { content: imageBase64 };
    } else {
      // URL-based (for scanning already uploaded images)
      imageContent = { source: { imageUri: imageUrl } };
    }

    const visionRequest = {
      requests: [
        {
          image: imageContent,
          features: [
            {
              type: 'SAFE_SEARCH_DETECTION',
            },
          ],
        },
      ],
    };

    // Call Google Vision API
    const response = await fetch(`${GOOGLE_VISION_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visionRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Vision API error:', errorText);
      // FAIL CLOSED: Block on API error
      return NextResponse.json(
        {
          safe: false,
          blocked: true,
          error: 'Unable to verify image safety',
          categories: {
            adult: 'UNKNOWN',
            violence: 'UNKNOWN',
            racy: 'UNKNOWN',
            medical: 'UNKNOWN',
            spoof: 'UNKNOWN',
          }
        } as ModerationResult,
        { status: 503 }
      );
    }

    const visionResponse: VisionAPIResponse = await response.json();
    
    if (visionResponse.responses[0]?.error) {
      console.error('Vision API returned error:', visionResponse.responses[0].error);
      return NextResponse.json(
        {
          safe: false,
          blocked: true,
          error: 'Unable to analyze image',
          categories: {
            adult: 'UNKNOWN',
            violence: 'UNKNOWN',
            racy: 'UNKNOWN',
            medical: 'UNKNOWN',
            spoof: 'UNKNOWN',
          }
        } as ModerationResult,
        { status: 503 }
      );
    }

    const safeSearchAnnotation = visionResponse.responses[0]?.safeSearchAnnotation;
    
    if (!safeSearchAnnotation) {
      console.error('No SafeSearch annotation in response');
      return NextResponse.json(
        {
          safe: false,
          blocked: true,
          error: 'Unable to analyze image content',
          categories: {
            adult: 'UNKNOWN',
            violence: 'UNKNOWN',
            racy: 'UNKNOWN',
            medical: 'UNKNOWN',
            spoof: 'UNKNOWN',
          }
        } as ModerationResult,
        { status: 503 }
      );
    }

    // Analyze the results
    const result = analyzeModeration(safeSearchAnnotation as {
      adult: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
      violence: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
      racy: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
      medical: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
      spoof: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
    });

    // Log blocked content for review (without storing the actual image)
    if (result.blocked) {
      const supabase = await createServerClient();
      const clientIP = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
      
      // Get user from auth if available
      const authHeader = request.headers.get('authorization');
      let userId = null;
      
      if (authHeader) {
        // Try to extract user from token
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id;
      }

      // Log to moderation_logs table
      try {
        await supabase.from('moderation_logs').insert({
          user_id: userId,
          ip_address: clientIP,
          action: 'blocked',
          categories: result.categories,
          block_reason: result.blockReason,
          image_type: imageBase64 ? 'base64' : 'url',
        });
      } catch (err) {
        // Don't fail the request if logging fails
        console.error('Failed to log moderation event:', err);
      }

      console.warn(`[MODERATION] Content blocked - Reason: ${result.blockReason}, IP: ${clientIP}, User: ${userId || 'anonymous'}`);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Moderation endpoint error:', error);
    // FAIL CLOSED: Block on any error
    return NextResponse.json(
      {
        safe: false,
        blocked: true,
        error: 'Moderation service unavailable',
        categories: {
          adult: 'UNKNOWN',
          violence: 'UNKNOWN',
          racy: 'UNKNOWN',
          medical: 'UNKNOWN',
          spoof: 'UNKNOWN',
        }
      } as ModerationResult,
      { status: 503 }
    );
  }
}

