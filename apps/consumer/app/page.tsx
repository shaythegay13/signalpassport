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
      <header className="app-header">
        <div className="logo-group">
          <h1>Signal Passport</h1>
          <span className="badge">App Two: Consumer</span>
        </div>
        <div>
          <span className="badge badge-neutral">Independent Client (Zero Network / Zero Analysis)</span>
        </div>
      </header>

      {/* Import Card */}
      <section className="card">
        <h2>Import Passport Bundle</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Inspects and verifies a standalone Signal Passport JSON bundle offline without contacting any blockchain RPC,
          upstream explorer, AI provider, or App One.
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
          <div className="dropzone-subtext">Supports valid JSON bundles conforming to schema version 1.0.0</div>
        </div>

        {isLoading && <div style={{ marginTop: "12px", color: "var(--text-muted)" }}>Validating bundle...</div>}
        {rawError && <div className="error-banner">{rawError}</div>}
      </section>

      {/* Sequential Verification Results */}
      {result && (
        <section className="card">
          <h2>Verification Sequence</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            The imported bundle undergoes four deterministic validation checks in strict order.
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
          <div className="status-duo">
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
              <h3 style={{ marginBottom: "12px" }}>Passport Payload Overview (Read from Bundle)</h3>

              {/* Partial Coverage Warning (PRD §14) */}
              {result.bundle.payload.coverage.coverageStatus === "partial" && (
                <div className="warning-box" style={{ marginBottom: "16px" }}>
                  <strong>Warning: Partial Coverage (PRD §14).</strong> This passport bundle reflects incomplete transaction history within the declared observation window ({result.bundle.payload.coverage.pageCount} page(s) retrieved). Downstream systems should note that activity may be undercounted.
                </div>
              )}

              {/* Zero Activity Notice (PRD §14) */}
              {result.bundle.payload.claims.length === 0 && (
                <div style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "var(--border-active)", padding: "12px 16px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.88rem" }}>
                  <strong>Zero Qualifying Activity:</strong> Stored passport records 0 qualifying outgoing transactions in the observation window. All 3 metrics evaluate to 0.
                </div>
              )}

              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-key">Subject Address</span>
                  <span className="meta-val">{result.bundle.payload.subjectAddress}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Source Chain ID</span>
                  <span className="meta-val">{result.bundle.payload.sourceChainId}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Observation Window (UTC)</span>
                  <span className="meta-val">
                    {result.bundle.payload.observationWindow.startUtc.slice(0, 10)} to{" "}
                    {result.bundle.payload.observationWindow.endUtc.slice(0, 10)}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Coverage Status</span>
                  <span className="meta-val">
                    <span className={`badge ${result.bundle.payload.coverage.coverageStatus === "partial" ? "badge-warning" : "badge-success"}`}>
                      {result.bundle.payload.coverage.coverageStatus}
                    </span>
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Snapshot Version / Generation Timestamp</span>
                  <span className="meta-val">
                    v{result.bundle.payload.snapshotVersion} — {result.bundle.payload.generationTimestamp}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-key">Stored Envelope Digest</span>
                  <span className="meta-val" style={{ fontSize: "0.78rem" }}>
                    {result.bundle.integrity.digest}
                  </span>
                </div>
              </div>

              <h4 style={{ marginBottom: "12px" }}>Deterministic Claims (Always 3 canonical metrics per PRD §7 & §14)</h4>
              <div className="metrics-grid">
                {[
                  { key: "observed_transaction_count", label: "OBSERVED TRANSACTIONS", units: "transactions" },
                  { key: "active_days", label: "ACTIVE DAYS (UTC)", units: "days" },
                  { key: "unique_recipients", label: "UNIQUE RECIPIENTS", units: "addresses" }
                ].map((m) => {
                  const claim = result.bundle.payload.claims.find((c) => c.metricType === m.key);
                  const val = claim ? claim.value : 0;
                  const units = claim ? claim.units : m.units;
                  const backingCount = claim ? claim.evidenceIds.length : 0;

                  return (
                    <div key={m.key} className="metric-card">
                      <div className="metric-label">{m.label}</div>
                      <div className="metric-val">{val}</div>
                      <div className="metric-units">
                        {units} ({backingCount} cited evidence records)
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: "16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Contains {result.bundle.payload.evidence.length} self-contained evidence records. No external API was consulted.
              </div>

              {/* Imported AI Explanation (PRD §10 - Display Only) */}
              {result.bundle.explanation ? (
                <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface-raised)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "1rem" }}>Imported Qualitative Explanation</h4>
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
                    <strong>Non-Payload Display Metadata:</strong> This qualitative explanation was attached to the envelope by the generator. It is NOT part of the canonical payload and is NOT verified by the cryptographic SHA-256 integrity check.
                  </div>

                  <p style={{ fontSize: "0.95rem", lineHeight: 1.6, margin: "12px 0", color: "var(--text)" }}>
                    "{result.bundle.explanation.summary}"
                  </p>

                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "10px", marginTop: "12px" }}>
                    <strong style={{ color: "var(--text)" }}>Cited Evidence Records ({result.bundle.explanation.evidenceIds.length}):</strong>{" "}
                    {result.bundle.explanation.evidenceIds.length === 0 ? (
                      <span>0 citations</span>
                    ) : (
                      <span>
                        {result.bundle.explanation.evidenceIds.map((id, idx) => (
                          <span key={id} style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginRight: "6px" }}>
                            {id.slice(0, 16)}...{idx < (result.bundle?.explanation?.evidenceIds.length ?? 0) - 1 ? "," : ""}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "20px", padding: "12px 16px", background: "var(--surface)", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-dim)" }}>
                  No optional AI explanation attached to this bundle. (Envelopes without explanations are valid and fully verifiable).
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
