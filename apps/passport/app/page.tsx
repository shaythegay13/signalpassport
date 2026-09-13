"use client";

import React, { useState } from "react";
import { validateEthereumAddress } from "@signal-passport/analysis";
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
    setUseExtendedWindow(false);
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

  const [useExtendedWindow, setUseExtendedWindow] = useState<boolean>(false);

  function useExample() {
    setAddressInput(EXAMPLE_SUBJECT);
    setAddressError(null);
    setUseExtendedWindow(false);
  }

  function useExtendedExample() {
    setAddressInput(EXAMPLE_SUBJECT);
    setAddressError(null);
    setUseExtendedWindow(true);
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const cleanAddress = addressInput.trim();
    const validation = validateEthereumAddress(cleanAddress);
    if (!validation.isValid) {
      setAddressError(validation.error || "Invalid Ethereum address");
      return;
    }
    const isExtended = useExtendedWindow && cleanAddress.toLowerCase() === EXAMPLE_SUBJECT.toLowerCase();

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
          maxPages: 30,
          useExtendedWindow: isExtended
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

  // Evidence records (all qualifying transactions backing the claims)
  const allEvidenceRecords: EvidenceRecord[] = bundle ? bundle.payload.evidence : [];

  const visibleEvidenceRecords = showAllEvidence
    ? allEvidenceRecords
    : allEvidenceRecords.slice(0, 8);

  return (
    <div className="shell">
      {/* Micro-Status Strip (Persistent real architecture facts) */}
      <div className="status-strip">
        <div className="status-strip-group">
          <div className="status-strip-item">
            <span className="status-dot" />
            <span>NETWORK: Ethereum Mainnet (Chain ID 1)</span>
          </div>
          <div className="status-strip-item">
            <span style={{ color: "var(--text-dim)" }}>|</span>
            <span>SOURCE: Blockscout REST v2 Public API</span>
          </div>
        </div>
        <div className="status-strip-group">
          <div className="status-strip-item">
            <span>OBSERVATION WINDOW: 30 Calendar Days (UTC)</span>
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
            <h1 className="text-headline-xl">Signal Passport</h1>
            <p style={{ margin: "4px 0 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Portable, tamper-evident onchain credentials for fintech
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="badge">Passport Generator</span>
          <span className="badge badge-success">Blockscout REST v2 Live</span>
          <a
            href="https://signal-passport-verifier-saved-by-the-plates-projects.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="badge"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            Open Offline Verifier
            <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>open_in_new</span>
          </a>
        </div>
      </header>

      {/* Move 1: Distinct Hero Section for Opening Statement */}
      {!bundle && (
        <section className="hero-section">
          <div className="hero-kicker">
            <span className="badge badge-neutral">Fintech Interoperability Layer</span>
          </div>
          <h2 className="hero-title">Portable, tamper-evident onchain credentials for fintech</h2>
          <p className="hero-description">
            Every fintech app that wants to understand a wallet's activity currently has to build its own pipeline to fetch and interpret blockchain history — over and over, for every app. Signal Passport does that work once: enter a wallet, get a portable record of its verified activity, and any other application can check that record for itself, without re-scanning the blockchain or taking your word for it.
          </p>
        </section>
      )}

      {/* Input Section: Full Form when idle/in-progress, Collapsed Bar when bundle present (M11) */}
      {!bundle ? (
        <section className="card">
          <div className="card-header-bar">
            <div className="card-header-left">
              <span className="card-header-icon material-symbols-outlined">settings</span>
              <span className="card-header-tag">PARAMETERS // WALLET QUERY</span>
            </div>
            <span className="badge badge-neutral">Public Explorer Ingestion</span>
          </div>

          <h3 className="card-title">Create a Wallet Passport</h3>
          <p className="card-desc">
            Enter any public Ethereum address to ingest onchain transaction history over the 30-day UTC observation window.
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
            <div className="example-box" style={{ marginTop: "6px" }}>
              Same wallet, richer real history:
              <button type="button" onClick={useExtendedExample}>
                {EXAMPLE_SUBJECT}
              </button>
              <span style={{ marginLeft: "6px" }}>(same real EOA, 100 qualifying transactions over its real ~21-month history)</span>
            </div>
          </form>

          {/* Live Pipeline Progress (Active State) */}
          {currentStage !== "idle" && currentStage !== "complete" && steps.length > 0 && (
            <div className="progress-list">
              {steps.map((s, idx) => (
                <div key={idx} className="progress-step">
                  <span className="step-indicator material-symbols-outlined">
                    {s.stage === "error" ? "cancel" : s.stage === "complete" ? "check_circle" : "hourglass_empty"}
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
            <div className="error-banner" style={{ marginTop: "16px" }}>Error: {errorMessage}</div>
          )}
        </section>
      ) : (
        /* Collapsed Input Bar when bundle present (M11) */
        <div className="compact-summary-bar">
          <div className="compact-summary-left">
            <span className="compact-summary-icon material-symbols-outlined">settings</span>
            <span className="compact-summary-title">Subject Wallet:</span>
            <span className="compact-summary-val font-mono">{bundle.payload.subjectAddress}</span>
            <span className="badge badge-success">Sealed Artifact</span>
          </div>
          <div className="compact-summary-actions">
            <button
              type="button"
              className="pipeline-toggle-btn"
              onClick={() => setShowPipelineDetails(!showPipelineDetails)}
            >
              {showPipelineDetails ? "Hide pipeline steps ▲" : "Inspect pipeline steps ▼"}
            </button>
            <button
              type="button"
              className="secondary-btn compact-action-btn"
              onClick={() => {
                setBundle(null);
                setSteps([]);
                setCurrentStage("idle");
                setExplanation(null);
                setErrorMessage(null);
              }}
            >
              Analyze another wallet ↻
            </button>
          </div>
        </div>
      )}

      {/* Expandable Pipeline Details when bundle is present (M11) */}
      {bundle && showPipelineDetails && steps.length > 0 && (
        <div className="card" style={{ marginBottom: "20px", padding: "16px" }}>
          <div className="card-header-bar" style={{ marginBottom: "12px", paddingBottom: "8px" }}>
            <div className="card-header-left">
              <span className="card-header-icon">📋</span>
              <span className="card-header-tag">INGESTION PIPELINE LOG</span>
            </div>
            <span className="badge badge-success">Completed</span>
          </div>
          <div className="progress-list" style={{ marginTop: 0 }}>
            {steps.map((s, idx) => (
              <div key={idx} className="progress-step">
                <span className="step-indicator material-symbols-outlined">
                  {s.stage === "error" ? "cancel" : s.stage === "complete" ? "check_circle" : "hourglass_empty"}
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
        </div>
      )}

      {/* Move 3: Grid-Based Result Layout (8-col main / 4-col sidebar) */}
      {bundle && (
        <div className="result-grid">
          {/* Main Column (8 col) */}
          <div className="result-main">
            {/* Primary Verified Metrics Card */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header-bar">
                <div className="card-header-left">
                  <span className="card-header-icon material-symbols-outlined">bar_chart</span>
                  <span className="card-header-tag">VERIFIED CLAIMS // 30-DAY WINDOW</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="badge badge-success">Passport Generated & Sealed</span>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Ethereum Mainnet (Chain ID 1)
                  </span>
                </div>
              </div>

              <div className="results-header-row">
                <div>
                  <h2 className="results-main-title">Verified Activity Metrics</h2>
                  <p className="results-subtitle">
                    Deterministic calculations over the 30-day observation window ({bundle.payload.observationWindow.startUtc.slice(0, 10)} to {bundle.payload.observationWindow.endUtc.slice(0, 10)}).
                  </p>
                </div>
                <div className="results-header-actions">
                  <button
                    type="button"
                    className="primary-btn export-btn-top"
                    onClick={handleExport}
                  >
                    <span className="material-symbols-outlined">download</span> Export Passport (.json)
                  </button>
                </div>
              </div>

              {/* Partial Coverage Notice (PRD §14) */}
              {bundle.payload.coverage.coverageStatus === "partial" && (
                <div className="warning-box" style={{ marginBottom: "16px" }}>
                  <strong>Partial Coverage Notice:</strong> Explorer pagination limit reached ({bundle.payload.coverage.pageCount} pages retrieved) before window end. Metrics reflect only transactions in retrieved pages and may undercount total activity (coverage status: <code>partial</code>).
                </div>
              )}

              {/* Zero Activity Notice (PRD §14) */}
              {bundle.payload.claims.length === 0 && (
                <div style={{ background: "rgba(88, 166, 255, 0.1)", border: "1px solid rgba(88, 166, 255, 0.3)", color: "var(--border-active)", padding: "12px 16px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.88rem" }}>
                  <strong>Zero Qualifying Activity:</strong> No successful outgoing transactions were observed for this wallet during the declared 30-day observation window. All metrics evaluate to 0.
                </div>
              )}

              {/* Move 4: Factual Record Notice (Streamlined Inline Card Treatment - M11) */}
              <div className="verdict-inline-note">
                <span className="verdict-card-icon material-symbols-outlined">balance</span>
                <div className="verdict-inline-body">
                  <strong className="verdict-inline-title">A factual record, not a verdict:</strong>{" "}
                  <span className="verdict-inline-text">
                    This is not a credit score, a trust rating, or a risk assessment. It does not identify who owns this wallet or say whether it can be trusted — it shows only what actually happened, with the evidence to check it yourself.
                  </span>
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
                      return (
                        <div
                          key={m.type}
                          className="metric-card"
                        >
                          <div className="metric-label">{m.label}</div>
                          <div className="metric-val">{val}</div>
                          <div className="metric-units">
                            {backingCount} supporting record(s) · {m.desc}
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

              {/* M12: Real data visualization — computed client-side from actual
                  evidence[].timestamp / evidence[].recipient. No fabricated fields;
                  see docs/prompts/M12-typography-icons-dataviz.md */}
              {(() => {
                const windowStart = new Date(bundle.payload.observationWindow.startUtc);
                const windowEnd = new Date(bundle.payload.observationWindow.endUtc);
                const dayMs = 24 * 60 * 60 * 1000;
                const startDay = Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), windowStart.getUTCDate());
                const endDay = Date.UTC(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth(), windowEnd.getUTCDate());
                const totalDays = Math.max(1, Math.round((endDay - startDay) / dayMs) + 1);

                // Chart A: daily activity buckets, real counts from evidence timestamps
                const dailyCounts: number[] = new Array(totalDays).fill(0);
                for (const rec of allEvidenceRecords) {
                  const t = new Date(rec.timestamp);
                  const recDay = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
                  const idx = Math.round((recDay - startDay) / dayMs);
                  if (idx >= 0 && idx < totalDays) dailyCounts[idx] += 1;
                }
                const maxDailyCount = Math.max(0, ...dailyCounts);
                const activityStepFor = (count: number) => {
                  if (count === 0 || maxDailyCount === 0) return 0;
                  return Math.max(1, Math.ceil((count / maxDailyCount) * 4));
                };
                const activeDayCount = dailyCounts.filter((c) => c > 0).length;

                // Chart B: recipient frequency, real counts from evidence recipients
                const recipientCounts = new Map<string, number>();
                for (const rec of allEvidenceRecords) {
                  const key = rec.recipient ? rec.recipient : "__contract_creation__";
                  recipientCounts.set(key, (recipientCounts.get(key) || 0) + 1);
                }
                const sortedRecipients = Array.from(recipientCounts.entries()).sort((a, b) => b[1] - a[1]);
                const topRecipients = sortedRecipients.slice(0, 5);
                const otherRecipients = sortedRecipients.slice(5);
                const otherCount = otherRecipients.reduce((sum, [, c]) => sum + c, 0);
                const maxRecipientCount = topRecipients.length > 0 ? topRecipients[0][1] : 0;

                if (allEvidenceRecords.length === 0) return null;

                return (
                  <div className="charts-section">
                    <div className="chart-panel">
                      <div className="chart-panel-title">
                        <span className="material-symbols-outlined">calendar_month</span>
                        <span className="text-headline-md">Activity by Day</span>
                      </div>
                      <div className="activity-strip">
                        {dailyCounts.map((count, idx) => {
                          const cellDate = new Date(startDay + idx * dayMs);
                          const dateLabel = cellDate.toISOString().slice(0, 10);
                          const step = activityStepFor(count);
                          return (
                            <div
                              key={idx}
                              className="activity-cell"
                              style={{ background: `var(--activity-${step})` }}
                              data-tooltip={`${dateLabel}: ${count} transaction${count === 1 ? "" : "s"}`}
                            />
                          );
                        })}
                      </div>
                      <div className="chart-caption">
                        {activeDayCount} of {totalDays} days in this window had qualifying activity ({Math.round((activeDayCount / totalDays) * 100)}%). Darker cells mark days with more transactions.
                      </div>
                    </div>

                    <div className="chart-panel">
                      <div className="chart-panel-title">
                        <span className="material-symbols-outlined">bar_chart</span>
                        <span className="text-headline-md">Recipient Frequency</span>
                      </div>
                      <div className="recipient-bars">
                        {topRecipients.map(([key, count]) => {
                          const label = key === "__contract_creation__"
                            ? "Contract Creation"
                            : `${key.slice(0, 8)}...${key.slice(-6)}`;
                          const widthPct = maxRecipientCount > 0 ? Math.max(4, (count / maxRecipientCount) * 100) : 0;
                          return (
                            <div className="recipient-bar-row" key={key}>
                              <span className="recipient-bar-label" style={{ fontFamily: key === "__contract_creation__" ? "var(--font-sans)" : "var(--font-mono)" }}>
                                {label}
                              </span>
                              <div className="recipient-bar-track">
                                <div className="recipient-bar-fill" style={{ width: `${widthPct}%` }} />
                              </div>
                              <span className="recipient-bar-value">{count}</span>
                            </div>
                          );
                        })}
                        {otherRecipients.length > 0 && (
                          <div className="recipient-bar-row">
                            <span className="recipient-bar-label">Other ({otherRecipients.length} recipients)</span>
                            <div className="recipient-bar-track">
                              <div
                                className="recipient-bar-fill"
                                style={{ width: `${maxRecipientCount > 0 ? Math.max(4, (otherCount / maxRecipientCount) * 100) : 0}%` }}
                              />
                            </div>
                            <span className="recipient-bar-value">{otherCount}</span>
                          </div>
                        )}
                      </div>
                      <div className="chart-caption">
                        Ranked by transaction count across all {allEvidenceRecords.length} qualifying transactions in this window.
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* AI Qualitative Synthesis (PRD §10) */}
            <div className="ai-section">
              <div className="ai-header">
                <div className="ai-header-left">
                  <h3 className="ai-header-title">AI Qualitative Summary</h3>
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
                    <span className="material-symbols-outlined">auto_awesome</span> Generate AI Summary
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

              <p className="ai-desc">
                An optional natural-language synthesis of the verified metrics above. Governed by 5 strict validation rules: it cannot invent numbers, cannot hallucinate evidence citations, and falls back to a deterministic template if validation fails. Failure of model calls never blocks passport generation or export.
              </p>

              {isExplaining && (
                <div style={{ padding: "14px 16px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  <span className="material-symbols-outlined">hourglass_empty</span> Querying model and verifying quantitative grounding against immutable claims...
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
                <div className="ai-box">
                  <div className="ai-meta-row">
                    <span className="badge">Model: {explanation.model}</span>
                    <span className={`badge ${explanation.isFallback ? "badge-warning" : "badge-success"}`}>
                      {explanation.isFallback ? "Deterministic Fallback" : "Verified Grounded"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginLeft: "auto" }}>
                      Generated: {explanation.generatedAt.replace("T", " ").replace(".000Z", " UTC")}
                    </span>
                  </div>

                  <p className="ai-summary-text">
                    "{explanation.summary}"
                  </p>

                  <div className="ai-citations-row">
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

                  <div className="ai-integrity-note">
                    Integrity note: This narrative summary is stored alongside the passport for human convenience. It is excluded from the canonical payload and does not alter the SHA-256 integrity hash.
                  </div>
                </div>
              )}
            </div>

            {/* Evidence Drawer */}
            <div className="evidence-section">
              <div className="evidence-header-row">
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                    Supporting Evidence
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                    All three metrics above are computed from the same {allEvidenceRecords.length} qualifying transactions shown below.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="badge">{allEvidenceRecords.length} Qualifying Transactions</span>
                  {allEvidenceRecords.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllEvidence(!showAllEvidence)}
                      style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.82rem", cursor: "pointer", textDecoration: "underline" }}
                    >
                      {showAllEvidence ? "Show first 8 rows ▲" : `Show all ${allEvidenceRecords.length} rows ▼`}
                    </button>
                  )}
                </div>
              </div>

              {/* Independent Verifiability Notice (PRD §7/§9) */}
              <div className="verifiability-box" style={{ margin: "14px 0 10px 0" }}>
                <span className="verifiability-box-icon material-symbols-outlined">search</span>
                <span>
                  Every transaction below is public. Click any row to confirm it yourself on Blockscout, a public blockchain explorer — you don't have to take Signal Passport's word for any of it.
                </span>
              </div>

              {allEvidenceRecords.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "12px" }}>
                  0 backing transactions. No qualifying onchain activity met the observation scope criteria.
                </p>
              ) : (
                <div className="evidence-table-container">
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
          </div>

          {/* Sidebar Column (4 col) */}
          <div className="result-sidebar">
            {/* Action Card: Export Artifact */}
            <div className="sidebar-card">
              <div className="card-header-bar" style={{ paddingBottom: "10px", marginBottom: "14px" }}>
                <div className="card-header-left">
                  <span className="card-header-icon material-symbols-outlined">inventory_2</span>
                  <span className="card-header-tag">CREDENTIAL ENVELOPE</span>
                </div>
                <span className="badge badge-neutral">Sealed Artifact</span>
              </div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "1.05rem" }}>Export Passport</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                Download the sealed JSON bundle. It can be verified independently by any consumer application without re-querying the blockchain.
              </p>
              <button
                type="button"
                className="primary-btn"
                onClick={handleExport}
                style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontSize: "0.95rem" }}
              >
                <span className="material-symbols-outlined">download</span> Export Passport Bundle (.json)
              </button>
              <div style={{ marginTop: "12px", fontSize: "0.76rem", color: "var(--text-dim)", lineHeight: 1.4 }}>
                Conforms to schema version 1.0.0. Integrity protected by SHA-256 over RFC 8785 canonical JSON.
              </div>
            </div>

            {/* Technical Metadata & Provenance Panel (Collapsible - M11) */}
            <div className="sidebar-card">
              <details open className="sidebar-meta-details">
                <summary className="sidebar-meta-summary">
                  <div className="card-header-left">
                    <span className="card-header-icon material-symbols-outlined">lock</span>
                    <span className="card-header-tag">PROVENANCE // METADATA</span>
                  </div>
                  <span className="sidebar-meta-hint">Toggle details ▼</span>
                </summary>

                <h4 className="sidebar-title" style={{ marginTop: "12px" }}>
                  Technical Details & Cryptographic Provenance
                </h4>

                <div className="meta-panel">
                  <div className="meta-item">
                    <span className="meta-key">Subject Address</span>
                    <span className="meta-val">{bundle.payload.subjectAddress}</span>
                    <span className="meta-caption">
                      Valid checksummed EOA (analysis measures activity, not identity or custody)
                    </span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-key">Source Network</span>
                    <span className="meta-val">Chain ID {bundle.payload.sourceChainId} (Ethereum Mainnet via Blockscout REST v2)</span>
                    <span className="meta-caption">
                      Public API, zero private indexers
                    </span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-key">Observation Window (UTC)</span>
                    <span className="meta-val">
                      {bundle.payload.observationWindow.startUtc.slice(0, 10)} to {bundle.payload.observationWindow.endUtc.slice(0, 10)} (30 days)
                    </span>
                    <span className="meta-caption">
                      Calendar day boundaries computed in UTC
                    </span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-key">Coverage Assessment</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "2px 0" }}>
                      <span className={`badge ${bundle.payload.coverage.coverageStatus === "partial" ? "badge-warning" : "badge-success"}`}>
                        {bundle.payload.coverage.coverageStatus === "complete_for_query"
                          ? "Complete for Window"
                          : bundle.payload.coverage.coverageStatus === "partial"
                          ? "Partial Coverage"
                          : "Unknown Coverage"}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        ({bundle.payload.coverage.coverageStatus})
                      </span>
                    </div>
                    <span className="meta-caption">
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
                    <div className="meta-val-accent">
                      {bundle.integrity.digest}
                    </div>
                    <span className="meta-caption">
                      Cryptographic seal covering the canonical JSON payload (RFC 8785). Any modification invalidates this hash.
                    </span>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
