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

      {/* Import Card */}
      <section className="card">
        <h2 style={{ marginTop: 0, marginBottom: "6px" }}>Verify a Passport Bundle</h2>
        <p style={{ color: "var(--text)", fontSize: "0.92rem", margin: "0 0 16px 0", lineHeight: 1.6 }}>
          Every fintech app that wants to understand a wallet's activity currently has to build its own pipeline to fetch and interpret blockchain history — over and over, for every app. Signal Passport does that work once: enter a wallet, get a portable record of its verified activity, and any other application can check that record for itself, without re-scanning the blockchain or taking your word for it.
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
        {rawError && <div className="error-banner">{rawError}</div>}
      </section>

      {/* Sequential Verification Results */}
      {result && (
        <section className="card">
          <h2 style={{ marginTop: 0, marginBottom: "4px", fontSize: "1.3rem" }}>Offline Verification Sequence</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "0 0 16px 0" }}>
            The imported bundle undergoes four independent deterministic checks executed locally by this consumer application:
          </p>

          <div className="step-checklist">
            {result.steps.map((st, idx) => (
              <div key={idx} className={`check-item ${st.passed ? "passed" : "failed"}`}>
                <span style={{ fontSize: "1.1rem" }}>{st.passed ? "✔" : "❌"}</span>
                <div style={{ flex: 1 }}>
                  <div className="check-title">{st.name}</div>
                  <div className="check-msg">{st.message}</div>
                  {st.detail && <div className="check-detail">{st.detail}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Dual Status Cards: Integrity vs Publication (Separated UI per PRD §8) */}
          <div className="status-duo" style={{ marginTop: "20px" }}>
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
            <div style={{ marginTop: "24px" }}>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginBottom: "16px" }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.15rem" }}>Verified Passport Claims</h3>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Objective facts read directly from the imported bundle's self-contained payload:
                </p>
              </div>

              {/* Partial Coverage Warning (PRD §14) */}
              {result.bundle.payload.coverage.coverageStatus === "partial" && (
                <div className="warning-box" style={{ marginBottom: "16px" }}>
                  <strong>Partial Coverage Warning:</strong> This passport reflects incomplete transaction history within the declared observation window ({result.bundle.payload.coverage.pageCount} page(s) retrieved). Activity may be undercounted (coverage status: <code>partial</code>).
                </div>
              )}

              {/* Zero Activity Notice (PRD §14) */}
              {result.bundle.payload.claims.length === 0 && (
                <div style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "var(--border-active)", padding: "12px 16px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.88rem" }}>
                  <strong>Zero Qualifying Activity:</strong> Stored passport records 0 qualifying outgoing transactions in the observation window. All 3 metrics evaluate to 0.
                </div>
              )}

              {/* Factual Record Notice (PRD §7/§9 - Intentional Design Choice) */}
              <div style={{ margin: "0 0 18px 0", padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>⚖️</span>
                <div style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "var(--text)" }}>
                  <strong style={{ display: "block", marginBottom: "3px", color: "var(--text)" }}>
                    A factual record, not a verdict
                  </strong>
                  This is not a credit score, a trust rating, or a risk assessment. It does not identify who owns this wallet or say whether it can be trusted — it shows only what actually happened, with the evidence to check it yourself.
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
                            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                              {m.contextLine}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div style={{ marginTop: "14px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Verified against {result.bundle.payload.evidence.length} self-contained onchain evidence records stored in the bundle. No external API was consulted.
              </div>

              {/* Independent Verifiability Notice (PRD §7/§9) */}
              <div style={{ margin: "14px 0 0 0", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.85rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔍</span>
                <span>
                  Every transaction in this bundle is public. Click any source reference to confirm it yourself on Blockscout, a public blockchain explorer — you don't have to take Signal Passport's word for any of it.
                </span>
              </div>

              {/* Technical Metadata Grid */}
              <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <h4 style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    Passport Envelope Metadata
                  </h4>
                  <span className="badge badge-neutral">Offline Verified</span>
                </div>

                <div className="meta-grid" style={{ marginBottom: 0 }}>
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
                    <span className="meta-val" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`badge ${result.bundle.payload.coverage.coverageStatus === "partial" ? "badge-warning" : "badge-success"}`}>
                        {result.bundle.payload.coverage.coverageStatus === "complete_for_query"
                          ? "Complete for Window"
                          : result.bundle.payload.coverage.coverageStatus === "partial"
                          ? "Partial Coverage"
                          : "Unknown Coverage"}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                        ({result.bundle.payload.coverage.coverageStatus})
                      </span>
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-key">Snapshot Version & Timestamp</span>
                    <span className="meta-val">
                      v{result.bundle.payload.snapshotVersion} · Sealed at {result.bundle.payload.generationTimestamp.replace("T", " ").replace(".000Z", " UTC")}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-key">Stored Envelope Digest</span>
                    <span className="meta-val" style={{ fontSize: "0.78rem", color: "var(--accent)" }}>
                      {result.bundle.integrity.digest}
                    </span>
                  </div>
                </div>
              </div>

              {/* Imported AI Explanation (PRD §10 - Display Only) */}
              {result.bundle.explanation ? (
                <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface-raised)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "1.02rem" }}>Imported Narrative Explanation</h4>
                      <span className="badge badge-neutral">Display Only</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span className="badge">Model: {result.bundle.explanation.model}</span>
                      <span className={`badge ${result.bundle.explanation.isFallback ? "badge-warning" : "badge-success"}`}>
                        {result.bundle.explanation.isFallback ? "Deterministic Fallback" : "LLM Grounded"}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: "rgba(210, 153, 34, 0.1)", border: "1px solid rgba(210, 153, 34, 0.3)", borderRadius: "6px", padding: "10px 14px", margin: "10px 0 14px 0", fontSize: "0.82rem", color: "var(--warning)" }}>
                    <strong>Display Metadata:</strong> This qualitative explanation was attached to the envelope for human readers. It is NOT part of the canonical payload and is NOT verified by the cryptographic SHA-256 integrity check.
                  </div>

                  <p style={{ fontSize: "0.95rem", lineHeight: 1.6, margin: "12px 0", color: "var(--text)" }}>
                    "{result.bundle.explanation.summary}"
                  </p>

                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "10px", marginTop: "12px" }}>
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
              ) : (
                <div style={{ marginTop: "20px", padding: "12px 16px", background: "var(--surface)", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-dim)" }}>
                  No optional AI narrative attached to this bundle. (Passport bundles without explanations are fully valid and cryptographically verifiable).
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
