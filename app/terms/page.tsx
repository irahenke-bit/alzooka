"use client";

import Link from "next/link";
import { Logo } from "@/app/components/Logo";

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Header */}
      <header
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo />
        </Link>
      </header>

      {/* Content */}
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 800 }}>
        <h1 style={{ marginBottom: 32, fontSize: 32 }}>Terms and Conditions</h1>
        
        <div style={{ 
          lineHeight: 1.8, 
          fontSize: 15,
          color: "var(--alzooka-cream)",
        }}>
          {/* 
            =====================================================
            PASTE YOUR TERMS AND CONDITIONS CONTENT BELOW
            =====================================================
            
            Replace this placeholder text with your full Terms and Conditions.
            You can use <p> tags for paragraphs, <h2> for section headings, etc.
            
            Example structure:
            
            <h2>1. Introduction</h2>
            <p>Your introduction text here...</p>
            
            <h2>2. User Accounts</h2>
            <p>Your user accounts text here...</p>
            
            etc.
          */}
          
          <p style={{ opacity: 0.7, fontStyle: "italic" }}>
            [Terms and Conditions content will be added here]
          </p>
          
          {/* END OF TERMS AND CONDITIONS CONTENT */}
        </div>

        <div style={{ marginTop: 40 }}>
          <Link 
            href="/signup" 
            style={{ 
              color: "var(--alzooka-gold)", 
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            ← Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
