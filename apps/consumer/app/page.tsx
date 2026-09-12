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
                    <span className="badge badge-success">{result.bundle.payload.coverage.coverageStatus}</span>
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

              <h4 style={{ marginBottom: "12px" }}>Deterministic Claims ({result.bundle.payload.claims.length})</h4>
              <div className="metrics-grid">
                {result.bundle.payload.claims.map((claim) => (
                  <div key={claim.claimId} className="metric-card">
                    <div className="metric-label">{claim.metricType.replace(/_/g, " ").toUpperCase()}</div>
                    <div className="metric-val">{claim.value}</div>
                    <div className="metric-units">
                      {claim.units} ({claim.evidenceIds.length} cited evidence records)
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Contains {result.bundle.payload.evidence.length} self-contained evidence records. No external API was consulted.
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
