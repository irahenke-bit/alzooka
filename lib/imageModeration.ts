/**
 * Image Moderation Library
 * 
 * Uses Google Cloud Vision API SafeSearch to detect:
 * - Adult content (explicit/racy)
 * - Violence
 * - Medical/gore content
 * - Spoofed content
 * 
 * IMPORTANT: This is your first line of defense against illegal content.
 * For CSAM-specific detection, integrate Microsoft PhotoDNA after registering with NCMEC.
 */

export type ModerationCategory = 'adult' | 'violence' | 'racy' | 'medical' | 'spoof';

export type ModerationLikelihood = 
  | 'UNKNOWN'
  | 'VERY_UNLIKELY'
  | 'UNLIKELY'
  | 'POSSIBLE'
  | 'LIKELY'
  | 'VERY_LIKELY';

export interface ModerationResult {
  safe: boolean;
  blocked: boolean;
  categories: {
    adult: ModerationLikelihood;
    violence: ModerationLikelihood;
    racy: ModerationLikelihood;
    medical: ModerationLikelihood;
    spoof: ModerationLikelihood;
  };
  blockReason?: string;
  error?: string;
}

export interface ModerationLogEntry {
  imageHash?: string;
  userId?: string;
  ipAddress?: string;
  blocked: boolean;
  categories: Record<string, string>;
  blockReason?: string;
  timestamp: string;
}

// Likelihood levels that trigger blocking
// VERY_LIKELY and LIKELY for adult content = immediate block
// This is ZERO TOLERANCE for potential CSAM
const BLOCK_THRESHOLDS: Record<ModerationCategory, ModerationLikelihood[]> = {
  adult: ['LIKELY', 'VERY_LIKELY'],      // Block explicit content
  violence: ['VERY_LIKELY'],              // Block extreme violence
  racy: ['VERY_LIKELY'],                  // Block very racy content
  medical: [],                            // Don't block medical (could be legitimate)
  spoof: [],                              // Don't block spoofed images
};

/**
 * Check if a likelihood level should trigger blocking for a category
 */
function shouldBlock(category: ModerationCategory, likelihood: ModerationLikelihood): boolean {
  return BLOCK_THRESHOLDS[category].includes(likelihood);
}

/**
 * Convert image file/blob to base64 for API submission
 */
export async function imageToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Moderate an image using the server-side API
 * Call this from client-side before/after upload
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  try {
    const response = await fetch('/api/moderate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        safe: false,
        blocked: true,
        categories: {
          adult: 'UNKNOWN',
          violence: 'UNKNOWN',
          racy: 'UNKNOWN',
          medical: 'UNKNOWN',
          spoof: 'UNKNOWN',
        },
        error: error.message || 'Moderation check failed',
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Moderation API error:', error);
    // On error, block by default for safety
    return {
      safe: false,
      blocked: true,
      categories: {
        adult: 'UNKNOWN',
        violence: 'UNKNOWN',
        racy: 'UNKNOWN',
        medical: 'UNKNOWN',
        spoof: 'UNKNOWN',
      },
      error: 'Failed to connect to moderation service',
    };
  }
}

/**
 * Moderate an image from base64 data (before upload)
 * This is the preferred method - check BEFORE storing
 */
export async function moderateImageBase64(base64Data: string): Promise<ModerationResult> {
  try {
    const response = await fetch('/api/moderate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64: base64Data }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        safe: false,
        blocked: true,
        categories: {
          adult: 'UNKNOWN',
          violence: 'UNKNOWN',
          racy: 'UNKNOWN',
          medical: 'UNKNOWN',
          spoof: 'UNKNOWN',
        },
        error: error.message || 'Moderation check failed',
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Moderation API error:', error);
    return {
      safe: false,
      blocked: true,
      categories: {
        adult: 'UNKNOWN',
        violence: 'UNKNOWN',
        racy: 'UNKNOWN',
        medical: 'UNKNOWN',
        spoof: 'UNKNOWN',
      },
      error: 'Failed to connect to moderation service',
    };
  }
}

/**
 * Analyze SafeSearch response and determine if image should be blocked
 */
export function analyzeModeration(safeSearchAnnotation: {
  adult: ModerationLikelihood;
  violence: ModerationLikelihood;
  racy: ModerationLikelihood;
  medical: ModerationLikelihood;
  spoof: ModerationLikelihood;
}): ModerationResult {
  const categories = {
    adult: safeSearchAnnotation.adult || 'UNKNOWN',
    violence: safeSearchAnnotation.violence || 'UNKNOWN',
    racy: safeSearchAnnotation.racy || 'UNKNOWN',
    medical: safeSearchAnnotation.medical || 'UNKNOWN',
    spoof: safeSearchAnnotation.spoof || 'UNKNOWN',
  };

  const blockReasons: string[] = [];

  // Check each category against block thresholds
  for (const [category, likelihood] of Object.entries(categories)) {
    if (shouldBlock(category as ModerationCategory, likelihood as ModerationLikelihood)) {
      blockReasons.push(`${category}: ${likelihood}`);
    }
  }

  const blocked = blockReasons.length > 0;

  return {
    safe: !blocked,
    blocked,
    categories,
    blockReason: blocked ? blockReasons.join(', ') : undefined,
  };
}

/**
 * User-friendly error message for blocked content
 */
export function getBlockedMessage(result: ModerationResult): string {
  if (!result.blocked) return '';
  
  if (result.error) {
    return 'Unable to verify image safety. Please try again.';
  }

  // Don't reveal specific detection details to potential bad actors
  return 'This image cannot be uploaded as it may violate our content policies. If you believe this is an error, please contact support.';
}

