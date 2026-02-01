"use client";

import { useState, useEffect } from "react";

type LinkPreviewData = {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  domain: string;
};

type Props = {
  url: string;
};

export function LinkPreview({ url }: Props) {
  // Extract domain immediately for instant display
  const domain = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  })();

  // Extract title from URL for sites that block scrapers (like Wikipedia)
  const fallbackTitle = (() => {
    try {
      const urlObj = new URL(url);
      // Wikipedia: extract page title from path
      if (urlObj.hostname.includes("wikipedia.org")) {
        const pathParts = urlObj.pathname.split("/");
        const wikiIndex = pathParts.indexOf("wiki");
        if (wikiIndex !== -1 && pathParts[wikiIndex + 1]) {
          return decodeURIComponent(pathParts[wikiIndex + 1].replace(/_/g, " "));
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  })();

  const [data, setData] = useState<LinkPreviewData>({
    url: url,
    domain: domain,
    title: fallbackTitle,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPreview() {
      try {
        // For Wikipedia, use their API instead of microlink
        if (domain.includes("wikipedia.org")) {
          try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split("/");
            const wikiIndex = pathParts.indexOf("wiki");
            if (wikiIndex !== -1 && pathParts[wikiIndex + 1]) {
              const pageTitle = pathParts[wikiIndex + 1];
              const lang = urlObj.hostname.split(".")[0]; // e.g., "en" from "en.wikipedia.org"
              
              const wikiResponse = await fetch(
                `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`
              );
              const wikiData = await wikiResponse.json();
              
              if (wikiData.title && wikiData.extract) {
                setData({
                  title: wikiData.title,
                  description: wikiData.extract,
                  image: wikiData.thumbnail?.source || wikiData.originalimage?.source,
                  url: url,
                  domain: domain,
                });
                setLoading(false);
                return;
              }
            }
          } catch {
            // Fall through to microlink
          }
        }

        // Use microlink.io free API for link previews with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(url)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.status === "success" && result.data) {
          // Check if title looks like a captcha/bot check page
          const badTitles = ["just a moment", "verifying", "checking your browser", "access denied"];
          const isBadTitle = badTitles.some(bad => 
            result.data.title?.toLowerCase().includes(bad)
          );

          setData({
            title: isBadTitle ? fallbackTitle : result.data.title,
            description: isBadTitle ? undefined : result.data.description,
            image: result.data.image?.url,
            url: url,
            domain: domain,
          });
        }
      } catch {
        // Keep the basic data we already have
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [url, domain, fallbackTitle]);

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        textDecoration: "none",
        marginBottom: 16,
        border: "1px solid rgba(240, 235, 224, 0.15)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--bg-card)",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(240, 235, 224, 0.15)";
      }}
    >
      {data.image && (
        <div
          style={{
            width: "100%",
            maxHeight: 300,
            overflow: "hidden",
            background: "#000",
          }}
        >
          <img
            src={data.image}
            alt=""
            style={{
              width: "100%",
              height: "auto",
              maxHeight: 300,
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              // Hide image if it fails to load
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div style={{ padding: "12px 16px" }}>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 4,
            textTransform: "lowercase",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {data.domain}
          {loading && <span style={{ opacity: 0.5 }}>• Loading...</span>}
        </div>
        {data.title && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 4,
              lineHeight: 1.3,
            }}
          >
            {data.title}
          </div>
        )}
        {data.description && (
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {data.description}
          </div>
        )}
        {!loading && !data.title && !data.image && (
          <div
            style={{
              fontSize: 14,
              color: "#0165FC",
              marginTop: 4,
            }}
          >
            Open link →
          </div>
        )}
      </div>
    </a>
  );
}
