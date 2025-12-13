"use client";

import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";

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
          <LogoWithText />
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
          <p style={{ opacity: 0.7, marginBottom: 24 }}>Last Updated: December 13, 2025</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>1. Acceptance of Terms</h2>
          <p>By accessing or using Alzooka (&quot;the Service&quot;), you agree to be bound by these Terms and Conditions. If you do not agree, you must discontinue use of the Service.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>2. Description of Service</h2>
          <p>Alzooka is a social media platform enabling users to share content and connect with others by lawful means. We may modify, suspend, or discontinue any aspect of the Service at our discretion.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>3. Eligibility</h2>
          <p>You must be at least 13 years old to use the Service. By using Alzooka, you confirm that you meet this requirement and have the legal capacity to enter into this agreement. We reserve the right to request proof of age and terminate accounts of users under 13.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>4. User Accounts</h2>
          <ul style={{ marginLeft: 20, marginBottom: 16 }}>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activities under your account.</li>
            <li>You must notify us immediately of any unauthorized use.</li>
            <li>We may terminate accounts that violate these Terms.</li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>5. User Content</h2>
          <p><strong>Your Rights:</strong> You retain ownership of content you post. By posting, you grant Alzooka a non‑exclusive, worldwide, royalty‑free license to use, display, and distribute your content solely to operate and improve the Service.</p>
          <p><strong>Your Responsibilities:</strong> You agree not to post content that:</p>
          <ul style={{ marginLeft: 20, marginBottom: 16 }}>
            <li>Violates laws or regulations</li>
            <li>Infringes intellectual property rights</li>
            <li>Contains malware or harmful code</li>
            <li>Harasses, threatens, or harms others</li>
            <li>Is spam or promotional material without consent</li>
            <li>Impersonates another person or entity</li>
            <li>Shares private information without permission</li>
          </ul>
          <p><strong>Content Moderation:</strong> We may remove content that violates these Terms, but we are not obligated to monitor all user content.</p>
          <p><strong>Section 230 Notice:</strong> Alzooka is a platform for user-generated content. Under Section 230 of the Communications Decency Act, we are not responsible for content posted by users.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>6. Intellectual Property</h2>
          <p>The Service, including its design, features, and underlying code, is owned by Ira Henke, and protected by copyright and other intellectual property laws. You may not copy, modify, or reverse engineer any part of the Service.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>7. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul style={{ marginLeft: 20, marginBottom: 16 }}>
            <li>Use automated systems (bots, scrapers) without permission</li>
            <li>Attempt unauthorized access to the Service or accounts</li>
            <li>Interfere with Service functionality</li>
            <li>Collect user information without consent</li>
            <li>Use the Service for illegal purposes</li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>8. Privacy</h2>
          <p>Your use of the Service is governed by our Privacy Policy, which explains how we collect and use your information. By using Alzooka, you consent to these practices.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>9. Disclaimer of Warranties</h2>
          <p>The Service is provided &quot;as is&quot; and &quot;as available.&quot; We make no warranties that the Service will be uninterrupted, secure, or error‑free. You use the Service at your own risk.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>10. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Alzooka shall not be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill. Our total liability shall not exceed the greater of $100 or the amount you paid us in the past twelve months.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>11. Indemnification</h2>
          <p>You agree to indemnify and hold harmless Alzooka, its officers, employees, and agents from claims, damages, losses, liabilities, and expenses arising from:</p>
          <ul style={{ marginLeft: 20, marginBottom: 16 }}>
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of others&apos; rights</li>
            <li>Content you post</li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>12. Termination</h2>
          <p>We may suspend or terminate your account at any time, with or without cause or notice. Upon termination, your right to use the Service ceases immediately.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>13. Dispute Resolution</h2>
          <p><strong>Governing Law:</strong> These Terms are governed by the laws of Michigan, USA.</p>
          <p><strong>Informal Resolution:</strong> You agree to contact us first to attempt informal resolution of disputes.</p>
          <p><strong>Arbitration:</strong> Any disputes shall be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. Arbitration shall take place in Michigan, USA. Each party shall bear its own costs and expenses, unless otherwise determined by the arbitrator. Claims qualifying for small claims court may be filed there instead.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>14. DMCA Compliance</h2>
          <p>If you believe your copyrighted work has been infringed on Alzooka, you may submit a notification under the Digital Millennium Copyright Act (DMCA). We will respond to valid takedown requests and may remove infringing content. Repeat infringers may have their accounts terminated.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>15. Changes to Terms</h2>
          <p>We may update these Terms at any time. Material changes will be posted with a new &quot;Last Updated&quot; date. Continued use of the Service constitutes acceptance of the revised Terms.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>16. Severability</h2>
          <p>If any provision is found unenforceable, the remaining provisions remain in full effect.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>17. Entire Agreement</h2>
          <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and Alzooka.</p>

          <h2 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>18. Contact Information</h2>
          <p>For questions, contact us at: <a href="mailto:Alzooka1976@gmail.com" style={{ color: "var(--alzooka-gold)" }}>Alzooka1976@gmail.com</a></p>
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
