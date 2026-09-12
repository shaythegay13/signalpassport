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
  const [addressInput, setAddressInput] = useState<string>("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [currentStage, setCurrentStage] = useState<string>("idle");
  const [bundle, setBundle] = useState<PassportBundle | null>(null);
  const [selectedMetricType, setSelectedMetricType] = useState<string>("observed_transaction_count");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProviderError, setIsProviderError] = useState<boolean>(false);

  // M5 AI Explanation state
  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  // M7 Narrative polish toggles
  const [showPipelineDetails, setShowPipelineDetails] = useState<boolean>(false);
  const [showAllEvidence, setShowAllEvidence] = useState<boolean>(false);

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
    setShowPipelineDetails(false);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: cleanAddress,
          maxPages: 10
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

  const visibleEvidenceRecords = showAllEvidence
    ? selectedEvidenceRecords
    : selectedEvidenceRecords.slice(0, 8);

  return (
    <div className="shell">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-group">
          <div>
            <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Signal Passport</h1>
            <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Portable, tamper-evident onchain credentials for fintech
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="badge">Passport Generator</span>
          <span className="badge badge-success">Blockscout REST v2 Live</span>
        </div>
      </header>

      {/* Input Card */}
      <section className="card">
        <h2 style={{ marginTop: 0, marginBottom: "6px" }}>Create a Wallet Passport</h2>
        <p style={{ color: "var(--text)", fontSize: "0.92rem", margin: "0 0 16px 0", lineHeight: 1.6 }}>
          Every fintech app that wants to understand a wallet's activity currently has to build its own pipeline to fetch and interpret blockchain history — over and over, for every app. Signal Passport does that work once: enter a wallet, get a portable record of its verified activity, and any other application can check that record for itself, without re-scanning the blockchain or taking your word for it.
        </p>

        <form onSubmit={handleAnalyze}>
          <div className="input-row">
            <input
              type="text"
              className="text-input"
              placeholder="0x... Ethereum wallet address"
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
              <strong>Invalid Address Format:</strong> {addressError}. No network request was dispatched.
            </div>
          )}

          <div className="example-box">
            Try example wallet:
            <button type="button" onClick={useExample}>
              {EXAMPLE_SUBJECT}
            </button>
            <span style={{ marginLeft: "6px" }}>(Active Ethereum EOA with 28 qualifying transactions)</span>
          </div>
        </form>

        {/* Live Pipeline Progress (Active State) */}
        {currentStage !== "idle" && currentStage !== "complete" && steps.length > 0 && (
          <div className="progress-list" style={{ marginTop: "20px" }}>
            {steps.map((s, idx) => (
              <div key={idx} className="progress-step">
                <span className="step-indicator">
                  {s.stage === "error" ? "❌" : s.stage === "complete" ? "✔" : "⏳"}
                </span>
                <div className="step-content">
                  <div className="step-title">
                    {s.message}
                  </div>
                  {s.detail && <div className="step-desc">{s.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Compact Completed State Summary (Task 2 Polish) */}
        {currentStage === "complete" && bundle && (
          <div style={{ marginTop: "18px", padding: "12px 16px", background: "rgba(46, 160, 67, 0.1)", border: "1px solid rgba(46, 160, 67, 0.3)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", color: "var(--success-text)" }}>
              <span>✔</span>
              <span>
                <strong>Analysis complete:</strong> Ingested transactions via public Blockscout REST v2 · <strong>{bundle.payload.claims.find(c => c.metricType === "observed_transaction_count")?.value ?? 0} qualifying transactions</strong> sealed into canonical payload
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPipelineDetails(!showPipelineDetails)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              {showPipelineDetails ? "Hide pipeline steps ▲" : "Inspect pipeline steps ▼"}
            </button>
          </div>
        )}

        {/* Expandable Pipeline Details (Preserves full honest telemetry on demand) */}
        {showPipelineDetails && steps.length > 0 && (
          <div className="progress-list" style={{ marginTop: "12px" }}>
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

        {/* Provider Unavailable Error Card (PRD §14 Invariant) */}
        {isProviderError && (
          <div style={{ background: "var(--danger-bg)", border: "1px solid rgba(248, 81, 73, 0.4)", borderRadius: "6px", padding: "16px", marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "var(--danger)", fontSize: "1rem" }}>
                Upstream Provider Unavailable (Network Failure)
              </strong>
              <span className="badge badge-danger">Operational Error</span>
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--text)", fontSize: "0.9rem" }}>
              {errorMessage}
            </p>
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "var(--surface)", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <strong>Operational Invariant:</strong> Blockscout explorer downtime or network failures are operational errors. They are <em>never</em> reported as zero wallet activity and never produce an empty passport.
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
          {/* Header & Primary Action */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span className="badge badge-success">Passport Generated & Sealed</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Ethereum Mainnet (Chain ID 1)
                </span>
              </div>
              <h2 style={{ margin: "4px 0", fontSize: "1.4rem" }}>Verified Activity Metrics</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "4px 0 0 0" }}>
                Deterministic calculations over the 30-day observation window ({bundle.payload.observationWindow.startUtc.slice(0, 10)} to {bundle.payload.observationWindow.endUtc.slice(0, 10)}). Click any metric card to inspect its supporting evidence.
              </p>
            </div>
            <button type="button" className="primary-btn" onClick={handleExport} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "0.92rem" }}>
              <span>📥</span> Export Passport Bundle (.json)
            </button>
          </div>

          {/* Partial Coverage Notice (PRD §14) */}
          {bundle.payload.coverage.coverageStatus === "partial" && (
            <div className="warning-box" style={{ marginBottom: "18px" }}>
              <strong>Partial Coverage Notice:</strong> Explorer pagination limit reached ({bundle.payload.coverage.pageCount} pages retrieved) before window end. Metrics reflect only transactions in retrieved pages and may undercount total activity (coverage status: <code>partial</code>).
            </div>
          )}

          {/* Zero Activity Notice (PRD §14) */}
          {bundle.payload.claims.length === 0 && (
            <div style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "var(--border-active)", padding: "12px 16px", borderRadius: "6px", marginBottom: "18px", fontSize: "0.88rem" }}>
              <strong>Zero Qualifying Activity:</strong> No successful outgoing transactions were observed for this wallet during the declared 30-day observation window. All metrics evaluate to 0.
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

          {/* Hero: Three Deterministic Metric Cards */}
          {(() => {
            const txClaim = bundle.payload.claims.find((c) => c.metricType === "observed_transaction_count");
            const activeDaysClaim = bundle.payload.claims.find((c) => c.metricType === "active_days");
            const recipientsClaim = bundle.payload.claims.find((c) => c.metricType === "unique_recipients");

            const txCount = txClaim ? txClaim.value : 0;
            const activeDays = activeDaysClaim ? activeDaysClaim.value : 0;
            const uniqueRecipients = recipientsClaim ? recipientsClaim.value : 0;

            const startMs = new Date(bundle.payload.observationWindow.startUtc).getTime();
            const endMs = new Date(bundle.payload.observationWindow.endUtc).getTime();
            const windowDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

            return (
              <div className="metrics-grid">
                {[
                  {
                    type: "observed_transaction_count",
                    label: "Observed Transactions",
                    desc: "successful outgoing txs",
                    contextLine: txCount > 0
                      ? `An average of one transaction every ${(windowDays / txCount).toFixed(1)} days`
                      : null
                  },
                  {
                    type: "active_days",
                    label: "Active Days (UTC)",
                    desc: "distinct calendar days",
                    contextLine: `${activeDays} of ${windowDays} days in this window (${Math.round((activeDays / windowDays) * 100)}%)`
                  },
                  {
                    type: "unique_recipients",
                    label: "Unique Recipients",
                    desc: "distinct destination addresses",
                    contextLine: uniqueRecipients > 0
                      ? `An average of ${(txCount / uniqueRecipients).toFixed(1)} transactions per recipient`
                      : null
                  }
                ].map((m) => {
                  const claim = bundle.payload.claims.find((c) => c.metricType === m.type);
                  const val = claim ? claim.value : 0;
                  const backingCount = claim ? claim.evidenceIds.length : 0;
                  const isSelected = selectedMetricType === m.type;

                  return (
                    <div
                      key={m.type}
                      className={`metric-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedMetricType(m.type)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="metric-label">{m.label}</div>
                      <div className="metric-val">{val}</div>
                      <div className="metric-units">
                        {backingCount} supporting record(s) · {m.desc}
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

          {/* AI Qualitative Synthesis (PRD §10) */}
          <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface-raised)", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>AI Qualitative Summary</h3>
                <span className="badge" style={{ background: "rgba(88, 166, 255, 0.15)", color: "#58a6ff", borderColor: "rgba(88, 166, 255, 0.4)" }}>
                  Optional Narrative
                </span>
                <span className="badge badge-neutral">Strictly Grounded</span>
              </div>
              {!explanation && !isExplaining && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleGenerateExplanation}
                  style={{ fontSize: "0.85rem", padding: "7px 14px" }}
                >
                  ✨ Generate AI Summary
                </button>
              )}
              {explanation && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleGenerateExplanation}
                  disabled={isExplaining}
                >
                  {isExplaining ? "Regenerating..." : "↻ Regenerate Summary"}
                </button>
              )}
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 14px 0", lineHeight: 1.5 }}>
              An optional natural-language synthesis of the verified metrics above. Governed by 5 strict validation rules: it cannot invent numbers, cannot hallucinate evidence citations, and falls back to a deterministic template if validation fails. Failure of model calls never blocks passport generation or export.
            </p>

            {isExplaining && (
              <div style={{ padding: "14px 16px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                <span>⏳</span> Querying model and verifying quantitative grounding against immutable claims...
              </div>
            )}

            {explainError && (
              <div style={{ padding: "12px 14px", background: "var(--danger-bg)", border: "1px solid rgba(248, 81, 73, 0.4)", borderRadius: "6px", color: "var(--danger)", fontSize: "0.85rem", marginBottom: "12px" }}>
                <strong>AI Generation Notice:</strong> {explainError}.
                <div style={{ marginTop: "4px", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                  Passport integrity and verified claims remain completely unaffected. You can still export the passport bundle.
                </div>
              </div>
            )}

            {explanation && (
              <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
                  <span className="badge">Model: {explanation.model}</span>
                  <span className={`badge ${explanation.isFallback ? "badge-warning" : "badge-success"}`}>
                    {explanation.isFallback ? "Deterministic Fallback" : "Verified Grounded"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginLeft: "auto" }}>
                    Generated: {explanation.generatedAt.replace("T", " ").replace(".000Z", " UTC")}
                  </span>
                </div>

                <p style={{ fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 12px 0", color: "var(--text)" }}>
                  "{explanation.summary}"
                </p>

                <div style={{ borderTop: "1px solid var(--surface-raised)", paddingTop: "10px", marginTop: "10px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--text)" }}>Cites {explanation.evidenceIds.length} verified evidence record(s):</strong>{" "}
                  {explanation.evidenceIds.length === 0 ? (
                    <span>0 citations</span>
                  ) : (
                    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px", marginLeft: "6px" }}>
                      {explanation.evidenceIds.map((id) => (
                        <span key={id} className="badge" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                          Tx {id.replace(/^1:/, "").slice(0, 10)}...
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <div style={{ marginTop: "10px", fontSize: "0.78rem", color: "var(--text-dim)" }}>
                  Integrity note: This narrative summary is stored alongside the passport for human convenience. It is excluded from the canonical payload and does not alter the SHA-256 integrity hash.
                </div>
              </div>
            )}
          </div>

          {/* Evidence Drill-down Drawer */}
          <div className="evidence-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                  Supporting Evidence: {METRIC_LABELS[selectedMetricType as keyof typeof METRIC_LABELS] || selectedMetricType}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                  Every claim is backed by source-verified onchain records. Click any transaction hash to inspect in Blockscout.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="badge">{selectedEvidenceRecords.length} Qualifying Transactions</span>
                {selectedEvidenceRecords.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllEvidence(!showAllEvidence)}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.82rem", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {showAllEvidence ? "Show first 8 rows ▲" : `Show all ${selectedEvidenceRecords.length} rows ▼`}
                  </button>
                )}
              </div>
            </div>

            {/* Independent Verifiability Notice (PRD §7/§9) */}
            <div style={{ margin: "14px 0 10px 0", padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "0.85rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🔍</span>
              <span>
                Every transaction below is public. Click any row to confirm it yourself on Blockscout, a public blockchain explorer — you don't have to take Signal Passport's word for any of it.
              </span>
            </div>

            {selectedEvidenceRecords.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "12px" }}>
                0 backing transactions. No qualifying onchain activity met the observation scope criteria.
              </p>
            ) : (
              <div style={{ maxHeight: "380px", overflowY: "auto", marginTop: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}>
                <table className="evidence-table" style={{ margin: 0 }}>
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
                    {visibleEvidenceRecords.map((rec) => (
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
          </div>

          {/* Technical Metadata & Provenance Section */}
          <div style={{ marginTop: "24px", padding: "16px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Technical Details & Cryptographic Provenance
            </h4>

            <div className="meta-grid" style={{ marginBottom: 0 }}>
              <div className="meta-item">
                <span className="meta-key">Subject Address</span>
                <span className="meta-val">{bundle.payload.subjectAddress}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Valid checksummed EOA (analysis measures activity, not identity or custody)
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Source Network</span>
                <span className="meta-val">Chain ID {bundle.payload.sourceChainId} (Ethereum Mainnet via Blockscout REST v2)</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Public API, zero private indexers
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Observation Window (UTC)</span>
                <span className="meta-val">
                  {bundle.payload.observationWindow.startUtc.slice(0, 10)} to {bundle.payload.observationWindow.endUtc.slice(0, 10)} (30 days)
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Calendar day boundaries computed in UTC
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Coverage Assessment</span>
                <span className="meta-val" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`badge ${bundle.payload.coverage.coverageStatus === "partial" ? "badge-warning" : "badge-success"}`}>
                    {bundle.payload.coverage.coverageStatus === "complete_for_query"
                      ? "Complete for Window"
                      : bundle.payload.coverage.coverageStatus === "partial"
                      ? "Partial Coverage"
                      : "Unknown Coverage"}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
                    ({bundle.payload.coverage.coverageStatus})
                  </span>
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  {bundle.payload.coverage.coverageStatus === "complete_for_query"
                    ? "All qualifying transactions within the declared 30-day window were retrieved."
                    : "Pagination limit reached; some historical transactions may not be included."}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Snapshot Version & Timestamp</span>
                <span className="meta-val">
                  v{bundle.payload.snapshotVersion} · Sealed at {bundle.payload.generationTimestamp.replace("T", " ").replace(".000Z", " UTC")}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-key">Canonical SHA-256 Payload Digest</span>
                <span className="meta-val" style={{ fontSize: "0.78rem" }}>
                  {bundle.integrity.digest}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Cryptographic seal covering the canonical JSON payload (RFC 8785). Any modification invalidates this hash.
                </span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
