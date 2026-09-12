"use client";

import React, { useState } from "react";
import { validateEthereumAddress } from "@signal-passport/analysis";
import { METRIC_LABELS } from "@signal-passport/analysis";
import type { PassportBundle, Claim, EvidenceRecord } from "@signal-passport/schema";

const EXAMPLE_SUBJECT = "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8";

type PipelineStep = {
  stage: "idle" | "fetching" | "normalizing" | "calculating" | "complete" | "error";
  message: string;
  detail?: string;
};

export default function PassportApp() {
  const [addressInput, setAddressInput] = useState<string>("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [currentStage, setCurrentStage] = useState<string>("idle");
  const [bundle, setBundle] = useState<PassportBundle | null>(null);
  const [selectedMetricType, setSelectedMetricType] = useState<string>("observed_transaction_count");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleAddressChange(val: string) {
    setAddressInput(val);
    if (!val.trim()) {
      setAddressError(null);
      return;
    }
    const check = validateEthereumAddress(val.trim());
    if (!check.isValid) {
      setAddressError(check.error || "Invalid Ethereum address");
    } else {
      setAddressError(null);
    }
  }

  function useExample() {
    setAddressInput(EXAMPLE_SUBJECT);
    setAddressError(null);
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const cleanAddress = addressInput.trim();
    const validation = validateEthereumAddress(cleanAddress);
    if (!validation.isValid) {
      setAddressError(validation.error || "Invalid Ethereum address");
      return;
    }

    setErrorMessage(null);
    setBundle(null);
    setSteps([]);
    setCurrentStage("fetching");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: cleanAddress })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({ error: "Network request failed" }));
        throw new Error(errorJson.error || `Server responded with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is not readable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.stage === "error") {
            throw new Error(event.error || "Analysis pipeline failed");
          }

          setCurrentStage(event.stage);
          setSteps((prev) => [
            ...prev,
            {
              stage: event.stage,
              message: event.message || `Stage: ${event.stage}`,
              detail: event.rawCount
                ? `${event.rawCount} items evaluated`
                : event.qualifyingCount !== undefined
                ? `${event.qualifyingCount} qualifying transactions`
                : undefined
            }
          ]);

          if (event.stage === "complete" && event.bundle) {
            setBundle(event.bundle);
            setCurrentStage("complete");
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setCurrentStage("error");
      setSteps((prev) => [
        ...prev,
        {
          stage: "error",
          message: "Pipeline halted",
          detail: msg
        }
      ]);
    }
  }

  function handleExport() {
    if (!bundle) return;
    const jsonString = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = bundle.payload.generationTimestamp.replace(/[:.]/g, "-");
    a.href = url;
    a.download = `passport-${bundle.payload.subjectAddress.slice(0, 10)}-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Evidence drill-down records for selected claim
  const selectedClaim = bundle?.payload.claims.find((c) => c.metricType === selectedMetricType);
  const evidenceMap = new Map<string, EvidenceRecord>();
  if (bundle) {
    for (const ev of bundle.payload.evidence) {
      evidenceMap.set(ev.evidenceId, ev);
    }
  }

  const selectedEvidenceRecords: EvidenceRecord[] = selectedClaim
    ? selectedClaim.evidenceIds.map((id) => evidenceMap.get(id)!).filter(Boolean)
    : [];

  return (
    <div className="shell">
      <header className="app-header">
        <div className="logo-group">
          <h1>Signal Passport</h1>
          <span className="badge">App One: Generator</span>
        </div>
        <div>
          <span className="badge badge-success">Blockscout REST v2 Live</span>
        </div>
      </header>

      {/* Input Card */}
      <section className="card">
        <h2>Generate Subject Passport</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Analyzes successful outgoing Ethereum transactions within the declared 30-day UTC window.
          Calculates three deterministic metrics and seals a canonical SHA-256 bundle.
        </p>

        <form onSubmit={handleAnalyze}>
          <div className="input-row">
            <input
              type="text"
              className="text-input"
              placeholder="0x... Ethereum address"
              value={addressInput}
              onChange={(e) => handleAddressChange(e.target.value)}
              disabled={currentStage !== "idle" && currentStage !== "complete" && currentStage !== "error"}
            />
            <button
              type="submit"
              className="primary-btn"
              disabled={
                !addressInput.trim() ||
                !!addressError ||
                (currentStage !== "idle" && currentStage !== "complete" && currentStage !== "error")
              }
            >
              Analyze Wallet
            </button>
          </div>

          {addressError && <div style={{ color: "var(--danger)", marginTop: "8px", fontSize: "0.85rem" }}>{addressError}</div>}

          <div className="example-box">
            Example wallet:
            <button type="button" onClick={useExample}>
              {EXAMPLE_SUBJECT}
            </button>
            <span style={{ marginLeft: "6px" }}>(Frozen M0 test EOA with 28 qualifying txs)</span>
          </div>
        </form>

        {/* Real Loading Pipeline States */}
        {steps.length > 0 && (
          <div className="progress-list">
            {steps.map((s, idx) => (
              <div key={idx} className="progress-step">
                <span className="step-indicator">
                  {s.stage === "error" ? "❌" : s.stage === "complete" ? "✔" : "⏳"}
                </span>
                <div className="step-content">
                  <div className="step-title">
                    {s.stage.toUpperCase()}: {s.message}
                  </div>
                  {s.detail && <div className="step-desc">{s.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {errorMessage && <div className="error-banner">Error: {errorMessage}</div>}
      </section>

      {/* Passport Output Screen */}
      {bundle && (
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <span className="badge badge-success">Passport Generated</span>
              <h2 style={{ marginTop: "8px", marginBottom: "4px" }}>Subject Overview</h2>
            </div>
            <button type="button" className="primary-btn" onClick={handleExport}>
              📥 Export Passport Bundle (.json)
            </button>
          </div>

          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-key">Subject Address</span>
              <span className="meta-val">{bundle.payload.subjectAddress}</span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Source Chain ID</span>
              <span className="meta-val">{bundle.payload.sourceChainId} (Ethereum Mainnet)</span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Observation Window (UTC)</span>
              <span className="meta-val">
                {bundle.payload.observationWindow.startUtc.slice(0, 10)} to {bundle.payload.observationWindow.endUtc.slice(0, 10)}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Coverage Status</span>
              <span className="meta-val">
                <span className="badge badge-success">{bundle.payload.coverage.coverageStatus}</span>
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Snapshot Version / Generation Timestamp</span>
              <span className="meta-val">
                v{bundle.payload.snapshotVersion} — {bundle.payload.generationTimestamp}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-key">Integrity SHA-256 Digest</span>
              <span className="meta-val" style={{ fontSize: "0.78rem" }}>
                {bundle.integrity.digest}
              </span>
            </div>
          </div>

          {/* Three Metric Cards (Using imported METRIC_LABELS) */}
          <h3 style={{ marginBottom: "12px" }}>Deterministic Claims (Click to Drill Down)</h3>
          <div className="metrics-grid">
            {bundle.payload.claims.map((claim) => {
              const label = METRIC_LABELS[claim.metricType as keyof typeof METRIC_LABELS] || claim.metricType;
              const isSelected = selectedMetricType === claim.metricType;

              return (
                <div
                  key={claim.claimId}
                  className={`metric-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedMetricType(claim.metricType)}
                >
                  <div className="metric-label">{label}</div>
                  <div className="metric-val">{claim.value}</div>
                  <div className="metric-units">
                    {claim.units} ({claim.evidenceIds.length} backing records)
                  </div>
                </div>
              );
            })}
          </div>

          {/* Evidence Drill-down */}
          {selectedClaim && (
            <div className="evidence-drawer">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>
                  Supporting Evidence: {METRIC_LABELS[selectedClaim.metricType as keyof typeof METRIC_LABELS]}
                </h4>
                <span className="badge">{selectedEvidenceRecords.length} Transactions</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                Every metric is grounded in verifiable onchain transactions. Click transaction hash to inspect in Blockscout.
              </p>

              <table className="evidence-table">
                <thead>
                  <tr>
                    <th>Tx Hash</th>
                    <th>Timestamp (UTC)</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Explorer Link</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvidenceRecords.map((rec) => (
                    <tr key={rec.evidenceId}>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)" }}>
                          {rec.transactionHash.slice(0, 10)}...{rec.transactionHash.slice(-8)}
                        </span>
                      </td>
                      <td>{rec.timestamp.replace("T", " ").replace(".000Z", "Z")}</td>
                      <td>
                        {rec.recipient ? (
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {rec.recipient.slice(0, 8)}...{rec.recipient.slice(-6)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-dim)" }}>Contract Creation</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-success">{rec.status}</span>
                      </td>
                      <td>
                        <a
                          href={rec.sourceReference}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono-link"
                        >
                          View on Blockscout ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
