# Content Moderation Setup Guide

This document explains how to set up and configure content moderation for your Alzooka platform.

## Overview

The content moderation system uses **Google Cloud Vision API SafeSearch** to detect and block inappropriate images BEFORE they are stored on your servers. This includes:

- Adult/explicit content
- Violence
- Racy content

**IMPORTANT**: Images are scanned BEFORE upload. Blocked content is NEVER stored on your servers.

---

## Quick Start

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Note your Project ID

### 2. Enable the Cloud Vision API

1. Go to **APIs & Services > Library**
2. Search for "Cloud Vision API"
3. Click **Enable**

### 3. Create an API Key

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the API key
4. (Recommended) Restrict the API key to only Cloud Vision API

### 4. Add Environment Variable

Add this to your `.env.local` file:

```bash
GOOGLE_CLOUD_API_KEY=your_api_key_here
```

For production (Vercel), add it to your Environment Variables in the dashboard.

### 5. Run the Database Migration

Run the SQL migration to create the moderation logs table:

```sql
-- Run this in your Supabase SQL editor
-- File: sql/create_moderation_logs.sql
```

### 6. Deploy and Test

1. Deploy your application
2. Try uploading a normal image - should succeed
3. The system is now active

---

## How It Works

### Flow Diagram

```
User selects image
        ↓
Image converted to base64 (client-side)
        ↓
Sent to /api/moderate-image endpoint
        ↓
Google Vision API SafeSearch analysis
        ↓
    BLOCKED?
    ↙     ↘
  YES      NO
   ↓        ↓
Block    Allow upload
Return   Continue to
error    Supabase storage
```

### Protected Upload Points

The following upload locations are protected:

| Location | File | Protected |
|----------|------|-----------|
| Main feed posts | `app/page.tsx` | ✅ |
| Profile posts | `app/profile/[username]/page.tsx` | ✅ |
| Group posts | `app/groups/[id]/page.tsx` | ✅ |
| Avatar upload | `app/components/AvatarUpload.tsx` | ✅ |
| Group avatar | `app/components/GroupAvatarUpload.tsx` | ✅ |
| Banner crop | `app/components/BannerCropModal.tsx` | ✅ |

### Detection Categories

| Category | Block Threshold | Description |
|----------|-----------------|-------------|
| Adult | LIKELY, VERY_LIKELY | Explicit/nude content |
| Violence | VERY_LIKELY | Extreme violence |
| Racy | VERY_LIKELY | Suggestive content |
| Medical | Not blocked | Medical/gore (legitimate use) |
| Spoof | Not blocked | Manipulated images |

---

## Costs

### Google Cloud Vision Pricing

| Monthly Volume | Cost per 1,000 images |
|----------------|----------------------|
| First 1,000 | **FREE** |
| 1,001 - 5,000,000 | $1.50 |
| 5,000,001+ | $0.60 |

### Estimated Monthly Costs

| Site Size | Images/Month | Est. Cost |
|-----------|--------------|-----------|
| Small (<100 users) | <1,000 | **$0** |
| Medium (100-1000 users) | 2,000-10,000 | $1.50-$15 |
| Large (1000+ users) | 20,000+ | $30+ |

---

## Security Best Practices

### Fail Closed

The system is designed to **fail closed** - if moderation fails for any reason (API error, network issue, missing config), uploads are BLOCKED by default. This ensures safety even during outages.

### Logging

All blocked uploads are logged to the `moderation_logs` table with:
- User ID (if authenticated)
- IP address
- Detection categories
- Timestamp

You can query this for security reviews:

```sql
SELECT * FROM moderation_logs 
WHERE action = 'blocked' 
ORDER BY created_at DESC 
LIMIT 100;
```

### Never Stored

Blocked images are NEVER stored to your Supabase storage. They are checked in memory before any upload occurs.

---

## Advanced: CSAM Detection with PhotoDNA

For enhanced protection against CSAM (Child Sexual Abuse Material), you should also integrate Microsoft PhotoDNA:

### What is PhotoDNA?

PhotoDNA is Microsoft's industry-standard CSAM detection technology, used by major platforms like Facebook, Twitter, and Discord.

### How to Apply

1. Go to [PhotoDNA Cloud Service](https://www.microsoft.com/en-us/photodna)
2. Apply for access (free for most platforms)
3. Wait for approval (usually 1-2 weeks)
4. Integrate with the moderation pipeline

### NCMEC Reporting

If you're a US-based platform, you're legally required to:
1. Report CSAM to NCMEC within 24 hours
2. Preserve evidence for 90 days
3. Cooperate with law enforcement

Register at [CyberTipline](https://www.missingkids.org/gethelpnow/cybertipline) for automated reporting.

---

## Troubleshooting

### "Content moderation is not configured"

**Cause**: `GOOGLE_CLOUD_API_KEY` environment variable is missing.

**Fix**: Add the API key to your environment variables.

### "Unable to verify image safety"

**Cause**: Google Vision API returned an error.

**Fix**: 
1. Check API key is valid
2. Check Cloud Vision API is enabled
3. Check API key restrictions

### Uploads being blocked unexpectedly

**Cause**: Image triggered SafeSearch detection.

**Check**: Query the moderation logs to see what category triggered:

```sql
SELECT categories, block_reason, created_at 
FROM moderation_logs 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC;
```

---

## Monitoring

### View Moderation Stats

```sql
SELECT 
  DATE(created_at) as date,
  action,
  COUNT(*) as count
FROM moderation_logs
GROUP BY DATE(created_at), action
ORDER BY date DESC;
```

### Daily Summary

```sql
SELECT 
  COUNT(*) FILTER (WHERE action = 'blocked') as blocked_today,
  COUNT(*) as total_checked_today
FROM moderation_logs 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Support

For issues with content moderation:

1. Check this documentation
2. Review the moderation logs
3. Test with Google Vision API directly
4. Contact support with logs and details

---

## Legal Disclaimer

This content moderation system is provided as a first line of defense. No automated system is 100% accurate. You should:

1. Maintain user reporting mechanisms
2. Have manual review processes for edge cases
3. Comply with all applicable laws in your jurisdiction
4. Consult with legal counsel for compliance requirements

