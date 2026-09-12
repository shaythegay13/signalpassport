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
        <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", margin: "0 0 16px 0", lineHeight: 1.5 }}>
          Import and verify any Signal Passport JSON bundle completely offline. This independent consumer application performs all checks locally—without contacting any blockchain RPCs, block explorers, AI providers, or App One.
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

              {/* Three Metric Cards */}
              <div className="metrics-grid">
                {[
                  { key: "observed_transaction_count", label: "Observed Transactions", units: "outgoing transactions" },
                  { key: "active_days", label: "Active Days (UTC)", units: "distinct calendar days" },
                  { key: "unique_recipients", label: "Unique Recipients", units: "destination addresses" }
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
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: "14px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Verified against {result.bundle.payload.evidence.length} self-contained onchain evidence records stored in the bundle. No external API was consulted.
              </div>

              {/* Technical Metadata Grid */}
              <div style={{ marginTop: "20px", padding: "16px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "0.88rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Passport Envelope Metadata
                </h4>

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
                    <span className="meta-val" style={{ fontSize: "0.78rem" }}>
                      {result.bundle.integrity.digest}
                    </span>
                  </div>
                </div>
              </div>

              {/* Imported AI Explanation (PRD §10 - Display Only) */}
              {result.bundle.explanation ? (
                <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface-raised)", borderRadius: "8px", border: "1px solid var(--border)" }}>
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
