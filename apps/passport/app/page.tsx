"use client";

import React, { useState } from "react";
import { validateEthereumAddress } from "@signal-passport/analysis";
import { METRIC_LABELS } from "@signal-passport/analysis";
import type { PassportBundle, Claim, EvidenceRecord, AiExplanation } from "@signal-passport/schema";

const EXAMPLE_SUBJECT = "0xc82f8B79Cd34bD98b1abEC72475F2a73Eb15CFA8";

type PipelineStep = {
  stage: "idle" | "fetching" | "normalizing" | "calculating" | "complete" | "error";
  message: string;
  detail?: string;
};

export default function PassportApp() {
  const [addressInput, setAddressInput] = useState<string>("" );
  const [addressError, setAddressError] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [currentStage, setCurrentStage] = useState<string>("idle");
  const [bundle, setBundle] = useState<PassportBundle | null>(null);
  const [selectedMetricType, setSelectedMetricType] = useState<string>("observed_transaction_count");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProviderError, setIsProviderError] = useState<boolean>(false);

  // M5 AI Explanation state (P0b stretch scope)
  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  // Simulation toggles for M4 edge states
  const [simulateZeroActivity, setSimulateZeroActivity] = useState<boolean>(false);
  const [simulatePartial, setSimulatePartial] = useState<boolean>(false);
  const [simulateProviderError, setSimulateProviderError] = useState<boolean>(false);

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
    setIsProviderError(false);
    setBundle(null);
    setExplanation(null);
    setExplainError(null);
    setIsExplaining(false);
    setSteps([]);
    setCurrentStage("fetching");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: cleanAddress,
          maxPages: simulatePartial ? 1 : 10,
          simulateEmptyActivity: simulateZeroActivity,
          simulateProviderError: simulateProviderError
        })
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
            if (event.isProviderError) {
              setIsProviderError(true);
            }
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
      if (
        msg.toLowerCase().includes("provider") ||
        msg.toLowerCase().includes("blockscout") ||
        msg.toLowerCase().includes("503") ||
        msg.toLowerCase().includes("connection refused")
      ) {
        setIsProviderError(true);
      }
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

  async function handleGenerateExplanation() {
    if (!bundle) return;
    setIsExplaining(true);
    setExplainError(null);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: bundle.payload })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: "Failed to generate explanation" }));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.explanation) {
        setExplanation(data.explanation);
      } else {
        throw new Error("No explanation returned from API");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExplainError(msg);
    } finally {
      setIsExplaining(false);
    }
  }

  function handleExport() {
    if (!bundle) return;
    const bundleToExport: PassportBundle = {
      ...bundle,
      ...(explanation ? { explanation } : {})
    };
    const jsonString = JSON.stringify(bundleToExport, null, 2);
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

          {addressError && (
            <div style={{ background: "var(--danger-bg)", border: "1px solid rgba(248, 81, 73, 0.4)", color: "var(--danger)", padding: "10px 14px", borderRadius: "6px", marginTop: "10px", fontSize: "0.85rem" }}>
              <strong>Pre-flight Rejection (PRD §14):</strong> {addressError}. No network request was dispatched.
            </div>
          )}

          <div className="example-box">
            Example wallet:
            <button type="button" onClick={useExample}>
              {EXAMPLE_SUBJECT}
            </button>
            <span style={{ marginLeft: "6px" }}>(Frozen M0 test EOA with 28 qualifying txs)</span>
          </div>

          <div style={{ marginTop: "16px", padding: "12px 16px", background: "var(--surface-raised)", borderRadius: "6px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", marginBottom: "8px", fontWeight: 600 }}>
              M4 Edge State Testing Controls (PRD §14)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "0.85rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={simulateZeroActivity}
                  onChange={(e) => {
                    setSimulateZeroActivity(e.target.checked);
                    if (e.target.checked) setSimulateProviderError(false);
                  }}
                />
                <span>Simulate Zero Activity</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={simulatePartial}
                  onChange={(e) => setSimulatePartial(e.target.checked)}
                />
                <span>Simulate Partial Coverage (Cap 1 page)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={simulateProviderError}
                  onChange={(e) => {
                    setSimulateProviderError(e.target.checked);
                    if (e.target.checked) setSimulateZeroActivity(false);
                  }}
                />
                <span>Simulate Provider Outage (HTTP 503)</span>
              </label>
            </div>
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

        {/* Provider Unavailable Error Card (PRD §14) */}
        {isProviderError && (
          <div style={{ background: "var(--danger-bg)", border: "1px solid rgba(248, 81, 73, 0.4)", borderRadius: "6px", padding: "16px", marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "var(--danger)", fontSize: "1rem" }}>
                Provider Unavailable (Upstream Infrastructure Failure)
              </strong>
              <span className="badge badge-danger">Operational Failure</span>
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--text)", fontSize: "0.9rem" }}>
              {errorMessage}
            </p>
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "var(--surface)", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <strong>PRD §14 Invariant:</strong> Upstream provider unavailability, HTTP 5xx errors, and rate limits are operational infrastructure failures. They are <em>never</em> treated as zero activity and must never generate an empty passport.
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {errorMessage && !isProviderError && (
          <div className="error-banner">Error: {errorMessage}</div>
        )}
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

          {/* Partial Coverage Warning Banner (PRD §14) */}
          {bundle.payload.coverage.coverageStatus === "partial" && (
            <div className="warning-box" style={{ marginBottom: "16px" }}>
              <strong>Warning: Partial Coverage (PRD §14).</strong> Upstream pagination limit reached before exhausting the 30-day window ({bundle.payload.coverage.pageCount} page(s) retrieved). Metrics reflect only observed transactions within available pages and are NOT complete for the entire query scope.
            </div>
          )}

          {/* Zero Activity Informational Notice (PRD §14) */}
          {bundle.payload.claims.length === 0 && (
            <div style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "var(--border-active)", padding: "12px 16px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.88rem" }}>
              <strong>Zero Qualifying Activity:</strong> No successful outgoing transactions were observed for this wallet in the declared 30-day UTC observation window. All 3 metrics deterministically evaluate to 0.
            </div>
          )}

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
                <span className={`badge ${bundle.payload.coverage.coverageStatus === "partial" ? "badge-warning" : "badge-success"}`}>
                  {bundle.payload.coverage.coverageStatus}
                </span>
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

          {/* Three Metric Cards (Always 3 canonical metrics per PRD §7 & §14) */}
          <h3 style={{ marginBottom: "12px" }}>Deterministic Claims (Click to Drill Down)</h3>
          <div className="metrics-grid">
            {[
              { type: "observed_transaction_count", label: "Observed Transactions", units: "transactions" },
              { type: "active_days", label: "Active Days (UTC)", units: "days" },
              { type: "unique_recipients", label: "Unique Recipients", units: "addresses" }
            ].map((m) => {
              const claim = bundle.payload.claims.find((c) => c.metricType === m.type);
              const val = claim ? claim.value : 0;
              const units = claim ? claim.units : m.units;
              const backingCount = claim ? claim.evidenceIds.length : 0;
              const isSelected = selectedMetricType === m.type;

              return (
                <div
                  key={m.type}
                  className={`metric-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedMetricType(m.type)}
                >
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-val">{val}</div>
                  <div className="metric-units">
                    {units} ({backingCount} backing records)
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Qualitative Explanation (P0b Stretch Scope - PRD §10) */}
          <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface-raised)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h4 style={{ margin: 0, fontSize: "1rem" }}>AI Qualitative Synthesis</h4>
                <span className="badge" style={{ background: "rgba(88, 166, 255, 0.15)", color: "#58a6ff", borderColor: "rgba(88, 166, 255, 0.4)" }}>
                  P0b Stretch Scope
                </span>
                <span className="badge badge-neutral">Display Only</span>
              </div>
              {!explanation && !isExplaining && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleGenerateExplanation}
                  style={{ fontSize: "0.85rem", padding: "7px 14px" }}
                >
                  ✨ Generate AI Explanation
                </button>
              )}
              {explanation && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleGenerateExplanation}
                  disabled={isExplaining}
                >
                  {isExplaining ? "Regenerating..." : "↻ Regenerate Explanation"}
                </button>
              )}
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: "0.83rem", margin: "0 0 14px 0" }}>
              Qualitative summary strictly grounded in immutable claims and evidence records. Failure of model calls never blocks Passport generation, verification, or export (PRD §4 invariant).
            </p>

            {isExplaining && (
              <div style={{ padding: "14px 16px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                <span>⏳</span> Querying model & validating claims (verifying verbatim numbers, coverage integrity, and evidence citations)...
              </div>
            )}

            {explainError && (
              <div style={{ padding: "12px 14px", background: "var(--danger-bg)", border: "1px solid rgba(248, 81, 73, 0.4)", borderRadius: "6px", color: "var(--danger)", fontSize: "0.85rem", marginBottom: "12px" }}>
                <strong>AI Explanation Notice:</strong> {explainError}.
                <div style={{ marginTop: "4px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                  Passport integrity and claims remain completely unaffected. You can still export the passport bundle.
                </div>
              </div>
            )}

            {explanation && (
              <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
                  <span className="badge">Model: {explanation.model}</span>
                  <span className={`badge ${explanation.isFallback ? "badge-warning" : "badge-success"}`}>
                    {explanation.isFallback ? "Deterministic Fallback" : "Grounded & Verified"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginLeft: "auto" }}>
                    Generated: {explanation.generatedAt.replace("T", " ").replace(".000Z", " UTC")}
                  </span>
                </div>

                <p style={{ fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 12px 0", color: "var(--text)" }}>
                  "{explanation.summary}"
                </p>

                <div style={{ borderTop: "1px solid var(--surface-raised)", paddingTop: "10px", marginTop: "10px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--text)" }}>Grounded Evidence References:</strong>{" "}
                  {explanation.evidenceIds.length === 0 ? (
                    <span>0 citations</span>
                  ) : (
                    <span>
                      {explanation.evidenceIds.length} verified record(s):{" "}
                      {explanation.evidenceIds.map((id, idx) => (
                        <span key={id} style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", marginRight: "6px" }}>
                          {id.slice(0, 16)}...{idx < explanation.evidenceIds.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Audit Note: This explanation is qualitative display text on the envelope. It does not alter or participate in the SHA-256 payload digest.
                </div>
              </div>
            )}
          </div>

          {/* Evidence Drill-down */}
          <div className="evidence-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4>
                Supporting Evidence: {METRIC_LABELS[selectedMetricType as keyof typeof METRIC_LABELS] || selectedMetricType}
              </h4>
              <span className="badge">{selectedEvidenceRecords.length} Transactions</span>
            </div>

            {selectedEvidenceRecords.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "12px" }}>
                0 backing transactions. No qualifying onchain activity met the observation scope criteria.
              </p>
            ) : (
              <>
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
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
