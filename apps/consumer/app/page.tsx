"use client";

import React, { useState, useRef } from "react";
import type { BundleValidationResult } from "./lib/types.js";

export default function ConsumerApp() {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<BundleValidationResult | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    setFileName(file.name);
    setRawError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const text = await file.text();
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        setRawError(`Failed to parse file as JSON: ${msg}`);
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedJson)
      });

      const data: BundleValidationResult = await response.json();
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRawError(`Validation request failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    (window as any).__loadPassportFile = processFile;
  });

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }

  return (
    <div className="shell">
      {/* Micro-Status Strip (Persistent real architecture facts) */}
      <div className="status-strip">
        <div className="status-strip-group">
          <div className="status-strip-item">
            <span className="status-dot" />
            <span>MODE: Offline Verifier (Air-Gapped)</span>
          </div>
          <div className="status-strip-item">
            <span style={{ color: "var(--text-dim)" }}>|</span>
            <span>ENVIRONMENT: Local Host · Zero Network</span>
          </div>
        </div>
        <div className="status-strip-group">
          <div className="status-strip-item">
            <span>SCHEMA: v1.0.0</span>
          </div>
          <div className="status-strip-item">
            <span style={{ color: "var(--text-dim)" }}>|</span>
            <span>DIGEST: SHA-256 (RFC 8785)</span>
          </div>
        </div>
      </div>

      {/* App Header */}
      <header className="app-header">
        <div className="logo-group">
          <div>
            <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Signal Passport</h1>
            <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Independent offline passport verifier
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="badge">Offline Verifier</span>
          <span className="badge badge-neutral">Zero Network · Zero Analysis</span>
        </div>
      </header>

      {/* Move 1: Distinct Hero Section for Opening Statement */}
      {!result && (
        <section className="hero-section">
          <div className="hero-kicker">
            <span className="badge badge-neutral">Independent Verification Service</span>
          </div>
          <h2 className="hero-title">Portable, tamper-evident onchain credentials for fintech</h2>
          <p className="hero-description">
            Every fintech app that wants to understand a wallet's activity currently has to build its own pipeline to fetch and interpret blockchain history — over and over, for every app. Signal Passport does that work once: enter a wallet, get a portable record of its verified activity, and any other application can check that record for itself, without re-scanning the blockchain or taking your word for it.
          </p>
        </section>
      )}

      {/* Import Card (Move 2: Document Header Pattern) */}
      {/* Import Section: Full Dropzone when idle, Collapsed Bar when result present (M11) */}
      {!result ? (
        <section className="card">
          <div className="card-header-bar">
            <div className="card-header-left">
              <span className="card-header-icon">📥</span>
              <span className="card-header-tag">BUNDLE IMPORT // OFFLINE INPUT</span>
            </div>
            <span className="badge badge-neutral">Air-Gapped Verifier</span>
          </div>

          <h3 className="card-title">Verify a Passport Bundle</h3>
          <p className="card-desc">
            Drop any exported Signal Passport bundle below to verify its cryptographic integrity and inspect its claims without internet access.
          </p>

          <div
            className={`dropzone ${dragActive ? "drag-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileSelect}
            />
            <div className="dropzone-icon">📄</div>
            <div className="dropzone-text">
              {fileName ? `Loaded: ${fileName}` : "Click to select or drag and drop a Passport JSON file"}
            </div>
            <div className="dropzone-subtext">
              Supports valid JSON bundles conforming to schema version 1.0.0 (try <code>fixtures/real/passport-bundle.json</code> for instant no-network demo)
            </div>
          </div>

          {isLoading && <div style={{ marginTop: "12px", color: "var(--text-muted)" }}>Running offline verification checks...</div>}
          {rawError && <div className="error-banner" style={{ marginTop: "14px" }}>{rawError}</div>}
        </section>
      ) : (
        /* Collapsed Import Bar when result present (M11) */
        <div className="compact-summary-bar">
          <div className="compact-summary-left">
            <span className="compact-summary-icon">📥</span>
            <span className="compact-summary-title">Imported File:</span>
            <span className="compact-summary-val font-mono">{fileName || "passport-bundle.json"}</span>
            <span className={`badge ${result.isValid ? "badge-success" : "badge-danger"}`}>
              {result.isValid ? "Offline Verified" : "Verification Failed"}
            </span>
          </div>
          <div className="compact-summary-actions">
            <button
              type="button"
              className="secondary-btn compact-action-btn"
              onClick={() => {
                setResult(null);
                setFileName(null);
                setRawError(null);
              }}
            >
              Verify another bundle ↻
            </button>
          </div>
        </div>
      )}

      {/* Move 3: Sequential Verification Results (8-col main / 4-col sidebar) */}
      {result && (
        <div className="result-grid">
          {/* Main Column (8 col) */}
          <div className="result-main">
            {/* Primary Verification & Claims Card */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header-bar">
                <div className="card-header-left">
                  <span className="card-header-icon">🔍</span>
                  <span className="card-header-tag">AUDIT LOG // DETERMINISTIC VERIFICATION</span>
                </div>
                <span className={`badge ${result.isValid ? "badge-success" : "badge-danger"}`}>
                  {result.isValid ? "All Checks Passed" : "Verification Failed"}
                </span>
              </div>

              <h2 style={{ marginTop: 0, marginBottom: "4px", fontSize: "1.3rem" }}>Offline Verification &amp; Verified Claims</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "0 0 16px 0" }}>
                Cryptographic integrity and publication status evaluated locally by this consumer application:
              </p>

              {/* Dual Status Cards: Integrity vs Publication (Separated UI per PRD §8) */}
              <div className="status-duo" style={{ marginBottom: "14px" }}>
                {/* 1. Integrity Status */}
                <div
                  className={`status-card ${
                    result.steps.find((s) => s.step === "integrity")?.passed ? "matched" : "mismatched"
                  }`}
                >
                  <div className="status-card-header">
                    <span className="status-card-title">{result.integrityLabel}</span>
                    <span
                      className={`badge ${
                        result.steps.find((s) => s.step === "integrity")?.passed ? "badge-success" : "badge-danger"
                      }`}
                    >
                      {result.steps.find((s) => s.step === "integrity")?.passed ? "Digest Match" : "Digest Mismatch"}
                    </span>
                  </div>
                  <div className="status-card-desc">{result.integrityExplanation}</div>
                </div>

                {/* 2. Publication Status */}
                <div className="status-card">
                  <div className="status-card-header">
                    <span className="status-card-title">{result.publicationLabel}</span>
                    <span className="badge badge-neutral">Publication Record</span>
                  </div>
                  <div className="status-card-desc">{result.publicationExplanation}</div>
                </div>
              </div>

              {/* Display Bundle Data (Read-only from bundle, never recomputed) */}
              {result.bundle && (
                <>
                  {/* Partial Coverage Warning (PRD §14) */}
                  {result.bundle.payload.coverage.coverageStatus === "partial" && (
                    <div className="warning-box" style={{ marginBottom: "14px" }}>
                      <strong>Partial Coverage Warning:</strong> This passport reflects incomplete transaction history within the declared observation window ({result.bundle.payload.coverage.pageCount} page(s) retrieved). Activity may be undercounted (coverage status: <code>partial</code>).
                    </div>
                  )}

                  {/* Zero Activity Notice (PRD §14) */}
                  {result.bundle.payload.claims.length === 0 && (
                    <div style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "var(--border-active)", padding: "12px 16px", borderRadius: "6px", marginBottom: "14px", fontSize: "0.88rem" }}>
                      <strong>Zero Qualifying Activity:</strong> Stored passport records 0 qualifying outgoing transactions in the observation window. All 3 metrics evaluate to 0.
                    </div>
                  )}

                  {/* Factual Record Notice (Streamlined Inline Card Treatment - M11) */}
                  <div className="verdict-inline-note" style={{ marginBottom: "14px" }}>
                    <span className="verdict-card-icon">⚖️</span>
                    <div className="verdict-inline-body">
                      <strong className="verdict-inline-title">A factual record, not a verdict:</strong>{" "}
                      <span className="verdict-inline-text">
                        This is not a credit score, a trust rating, or a risk assessment. It does not identify who owns this wallet or say whether it can be trusted — it shows only what actually happened, with the evidence to check it yourself.
                      </span>
                    </div>
                  </div>

                  {/* Three Metric Cards */}
                  {(() => {
                    const txClaim = result.bundle?.payload.claims.find((c) => c.metricType === "observed_transaction_count");
                    const activeDaysClaim = result.bundle?.payload.claims.find((c) => c.metricType === "active_days");
                    const recipientsClaim = result.bundle?.payload.claims.find((c) => c.metricType === "unique_recipients");

                    const txCount = txClaim ? txClaim.value : 0;
                    const activeDays = activeDaysClaim ? activeDaysClaim.value : 0;
                    const uniqueRecipients = recipientsClaim ? recipientsClaim.value : 0;

                    const startMs = new Date(result.bundle.payload.observationWindow.startUtc).getTime();
                    const endMs = new Date(result.bundle.payload.observationWindow.endUtc).getTime();
                    const windowDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

                    return (
                      <div className="metrics-grid">
                        {[
                          {
                            key: "observed_transaction_count",
                            label: "Observed Transactions",
                            units: "outgoing transactions",
                            contextLine: txCount > 0
                              ? `An average of one transaction every ${(windowDays / txCount).toFixed(1)} days`
                              : null
                          },
                          {
                            key: "active_days",
                            label: "Active Days (UTC)",
                            units: "distinct calendar days",
                            contextLine: `${activeDays} of ${windowDays} days in this window (${Math.round((activeDays / windowDays) * 100)}%)`
                          },
                          {
                            key: "unique_recipients",
                            label: "Unique Recipients",
                            units: "destination addresses",
                            contextLine: uniqueRecipients > 0
                              ? `An average of ${(txCount / uniqueRecipients).toFixed(1)} transactions per recipient`
                              : null
                          }
                        ].map((m) => {
                          const claim = result.bundle?.payload.claims.find((c) => c.metricType === m.key);
                          const val = claim ? claim.value : 0;
                          const backingCount = claim ? claim.evidenceIds.length : 0;

                          return (
                            <div key={m.key} className="metric-card">
                              <div className="metric-label">{m.label}</div>
                              <div className="metric-val">{val}</div>
                              <div className="metric-units">
                                {backingCount} supporting record(s) · {m.units}
                              </div>
                              {m.contextLine && (
                                <div className="metric-context-line">
                                  {m.contextLine}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Compact 4-Check Checklist Grid (M11) */}
                  <div style={{ marginTop: "18px", marginBottom: "8px", fontSize: "0.88rem", fontWeight: 600, color: "var(--text)" }}>
                    Deterministic Verification Checks (4/4 evaluated locally):
                  </div>
                  <div className="checklist-compact-grid">
                    {result.steps.map((st, idx) => (
                      <div key={idx} className={`check-chip ${st.passed ? "passed" : "failed"}`}>
                        <div className="check-chip-header">
                          <div className="check-chip-left">
                            <span className={`check-chip-num ${st.passed ? "passed" : "failed"}`}>
                              {st.passed ? "✔" : "❌"}
                            </span>
                            <span className="check-chip-name">{st.name}</span>
                          </div>
                          <span className={`badge ${st.passed ? "badge-success" : "badge-danger"}`}>
                            {st.passed ? "PASS" : "FAIL"}
                          </span>
                        </div>
                        <div className="check-chip-msg">{st.message}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "14px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Verified against {result.bundle.payload.evidence.length} self-contained onchain evidence records stored in the bundle. No external API was consulted.
                  </div>

                  {/* Independent Verifiability Notice (PRD §7/§9) */}
                  <div className="verifiability-box" style={{ marginTop: "14px" }}>
                    <span className="verifiability-box-icon">🔍</span>
                    <span>
                      Every transaction in this bundle is public. Click any source reference to confirm it yourself on Blockscout, a public blockchain explorer — you don't have to take Signal Passport's word for any of it.
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Expandable Raw Payload View (M11) */}
            {result.bundle && (
              <div className="raw-payload-card">
                <details className="raw-payload-details">
                  <summary>
                    <span className="card-header-icon">📄</span>
                    <span>Inspect Raw JSON Payload ({result.bundle.payload.evidence.length} evidence records, {result.bundle.payload.claims.length} claims)</span>
                    <span className="raw-payload-toggle-hint">Click to expand ▼</span>
                  </summary>
                  <div className="raw-payload-content">
                    <div className="raw-payload-bar">
                      <span>RFC 8785 Canonical Representation Target</span>
                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                        onClick={() => {
                          if (result.bundle) {
                            navigator.clipboard?.writeText(JSON.stringify(result.bundle, null, 2));
                          }
                        }}
                      >
                        Copy JSON 📋
                      </button>
                    </div>
                    <pre className="raw-json-pre">
                      {JSON.stringify(result.bundle, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            )}

            {/* Imported AI Explanation (PRD §10 - Display Only) */}
            {result.bundle?.explanation ? (
              <div className="ai-section">
                <div className="ai-header">
                  <div className="ai-header-left">
                    <h4 className="ai-header-title">Imported Narrative Explanation</h4>
                    <span className="badge badge-neutral">Display Only</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span className="badge">Model: {result.bundle.explanation.model}</span>
                    <span className={`badge ${result.bundle.explanation.isFallback ? "badge-warning" : "badge-success"}`}>
                      {result.bundle.explanation.isFallback ? "Deterministic Fallback" : "LLM Grounded"}
                    </span>
                  </div>
                </div>

                <div style={{ background: "rgba(255, 185, 95, 0.1)", border: "1px solid rgba(255, 185, 95, 0.35)", borderRadius: "6px", padding: "10px 14px", margin: "10px 0 14px 0", fontSize: "0.82rem", color: "var(--warning)" }}>
                  <strong>Display Metadata:</strong> This qualitative explanation was attached to the envelope for human readers. It is NOT part of the canonical payload and is NOT verified by the cryptographic SHA-256 integrity check.
                </div>

                <p className="ai-summary-text">
                  "{result.bundle.explanation.summary}"
                </p>

                <div className="ai-citations-row">
                  <strong style={{ color: "var(--text)" }}>Cited Evidence Records ({result.bundle.explanation.evidenceIds.length}):</strong>{" "}
                  {result.bundle.explanation.evidenceIds.length === 0 ? (
                    <span>0 citations</span>
                  ) : (
                    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px", marginLeft: "6px" }}>
                      {result.bundle.explanation.evidenceIds.map((id) => (
                        <span key={id} className="badge" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                          Tx {id.replace(/^1:/, "").slice(0, 10)}...
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ) : result.bundle ? (
              <div style={{ padding: "12px 16px", background: "var(--surface)", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-dim)" }}>
                No optional AI narrative attached to this bundle. (Passport bundles without explanations are fully valid and cryptographically verifiable).
              </div>
            ) : null}
          </div>

          {/* Sidebar Column (4 col) */}
          <div className="result-sidebar">
            {/* Overall Verification Status Card (Consolidated - M11) */}
            <div className="sidebar-card">
              <div className="card-header-bar" style={{ paddingBottom: "10px", marginBottom: "14px" }}>
                <div className="card-header-left">
                  <span className="card-header-icon">🛡️</span>
                  <span className="card-header-tag">VERIFICATION STATUS</span>
                </div>
                <span className={`badge ${result.isValid ? "badge-success" : "badge-danger"}`}>
                  {result.isValid ? "VERIFIED" : "INVALID"}
                </span>
              </div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "1.05rem" }}>
                {result.isValid ? "Cryptographically Sound" : "Verification Failed"}
              </h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", margin: 0, lineHeight: 1.5 }}>
                {result.isValid
                  ? "All local deterministic tests passed: schema validity, subject consistency, coverage sanity, and canonical SHA-256 payload integrity."
                  : "One or more offline validation steps failed. See audit log for specific failure details."}
              </p>
            </div>

            {/* Technical Metadata & Provenance Panel (Collapsible - M11) */}
            {result.bundle && (
              <div className="sidebar-card">
                <details open className="sidebar-meta-details">
                  <summary className="sidebar-meta-summary">
                    <div className="card-header-left">
                      <span className="card-header-icon">🔐</span>
                      <span className="card-header-tag">ENVELOPE METADATA</span>
                    </div>
                    <span className="sidebar-meta-hint">Toggle details ▼</span>
                  </summary>

                  <h4 className="sidebar-title" style={{ marginTop: "12px" }}>
                    Passport Envelope Metadata
                  </h4>

                  <div className="meta-panel">
                    <div className="meta-item">
                      <span className="meta-key">Subject Address</span>
                      <span className="meta-val">{result.bundle.payload.subjectAddress}</span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-key">Source Network</span>
                      <span className="meta-val">Chain ID {result.bundle.payload.sourceChainId} (Ethereum Mainnet)</span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-key">Observation Window (UTC)</span>
                      <span className="meta-val">
                        {result.bundle.payload.observationWindow.startUtc.slice(0, 10)} to{" "}
                        {result.bundle.payload.observationWindow.endUtc.slice(0, 10)} (30 days)
                      </span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-key">Coverage Assessment</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "2px 0" }}>
                        <span className={`badge ${result.bundle.payload.coverage.coverageStatus === "partial" ? "badge-warning" : "badge-success"}`}>
                          {result.bundle.payload.coverage.coverageStatus === "complete_for_query"
                            ? "Complete for Window"
                            : result.bundle.payload.coverage.coverageStatus === "partial"
                            ? "Partial Coverage"
                            : "Unknown Coverage"}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                          ({result.bundle.payload.coverage.coverageStatus})
                        </span>
                      </div>
                    </div>

                    <div className="meta-item">
                      <span className="meta-key">Snapshot Version & Timestamp</span>
                      <span className="meta-val">
                        v{result.bundle.payload.snapshotVersion} · Sealed at {result.bundle.payload.generationTimestamp.replace("T", " ").replace(".000Z", " UTC")}
                      </span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-key">Stored Envelope Digest</span>
                      <div className="meta-val-accent">
                        {result.bundle.integrity.digest}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
