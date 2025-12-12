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
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchPreview() {
      try {
        // Use microlink.io free API for link previews
        const response = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(url)}`
        );
        const result = await response.json();

        if (result.status === "success" && result.data) {
          const domain = new URL(url).hostname.replace("www.", "");
          setData({
            title: result.data.title,
            description: result.data.description,
            image: result.data.image?.url,
            url: url,
            domain: domain,
          });
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div
        style={{
          background: "var(--alzooka-teal-light)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          border: "1px solid rgba(240, 235, 224, 0.1)",
        }}
      >
        <div style={{ color: "var(--alzooka-cream)", opacity: 0.5, fontSize: 13 }}>
          Loading preview...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Don't show anything if preview fails
  }

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
        background: "var(--alzooka-teal-light)",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(240, 235, 224, 0.3)";
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
            color: "var(--alzooka-cream)",
            opacity: 0.5,
            marginBottom: 4,
            textTransform: "lowercase",
          }}
        >
          {data.domain}
        </div>
        {data.title && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--alzooka-cream)",
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
              color: "var(--alzooka-cream)",
              opacity: 0.7,
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
      </div>
    </a>
  );
}
