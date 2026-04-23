"use client";

import React from "react";
import Link from "next/link";

export default function Hero() {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 56px)",
        padding: "80px 24px",
        maxWidth: 720,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      {/* Headline */}
      <h1
        style={{
          fontSize: 48,
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
          color: "var(--text)",
          marginBottom: 20,
        }}
      >
        Meme token intelligence,
        <br />
        <span style={{ color: "var(--text-2)" }}>by adversarial debate.</span>
      </h1>

      {/* Description */}
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--text-2)",
          maxWidth: 520,
          marginBottom: 40,
        }}
      >
        Autonomous AI agents evaluate newly launched tokens on BNB Chain.
        Real-time cultural analysis and manipulation detection.
      </p>

      {/* CTA */}
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--bg)",
          background: "var(--text)",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        Open Dashboard
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          style={{ marginLeft: 2 }}
        >
          <path
            d="M6 3l5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      {/* Features */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 40,
          marginTop: 80,
          width: "100%",
          maxWidth: 600,
        }}
      >
        <Feature title="Multi-agent debate" desc="Optimist vs Skeptic — adversarial AI analysis that resists gaming." />
        <Feature title="On-chain signal" desc="TX velocity, LP depth, holder distribution from BSC in real time." />
        <Feature title="Live verdicts" desc="Plain-English cultural briefs, published autonomously." />
      </div>
    </section>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--text-3)",
        }}
      >
        {desc}
      </p>
    </div>
  );
}
