"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { STAGES, DAYS, DAY_LABELS, DAY_FULL, STAGE_NAMES, COLORS } from "@/lib/data";
import { addMember, getMembers, onMembersChange, savePicks, getPicks, onAllPicksChange, clearPicks as clearPicksDB } from "@/lib/db";

export default function UltraHeatmap() {
  const [currentUser, setCurrentUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [allPicks, setAllPicks] = useState({});
  const [tab, setTab] = useState("heatmap");
  const [activeDay, setActiveDay] = useState("fri");
  const [showConfirm, setShowConfirm] = useState(false);
  const [resultsFilter, setResultsFilter] = useState("all");
  const saveTimer = useRef(null);

  // My selections
  const selections = currentUser ? (allPicks[currentUser] || {}) : {};

  // ─── Firebase listeners ───────────────────────────────────────────────────
  useEffect(() => {
    let unsubMembers, unsubPicks;

    const init = async () => {
      const m = await getMembers();
      setMembers(m);

      // Listen for real-time updates
      unsubMembers = onMembersChange((newMembers) => setMembers(newMembers));
      unsubPicks = onAllPicksChange((rawPicks) => {
        // rawPicks is keyed by sanitized name, we need to map back to display names
        // For simplicity, store picks keyed by sanitized name and resolve on display
        setAllPicks(rawPicks);
      });

      setLoading(false);
    };

    init();
    return () => {
      if (unsubMembers) unsubMembers();
      if (unsubPicks) unsubPicks();
    };
  }, []);

  // Resolve picks: Firebase stores by sanitized key, we map to display name
  const sanitize = (name) =>
    name.toLowerCase().replace(/[.$#\[\]\/\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "user";

  const myPicks = currentUser ? (allPicks[sanitize(currentUser)] || {}) : {};

  const joinAs = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCurrentUser(trimmed);
    await addMember(trimmed);
  };

  const getKey = (stage, day, artist) => `${stage}|${day}|${artist}`;

  const handleClick = useCallback((stage, day, artist) => {
    if (!currentUser) return;
    const key = getKey(stage, day, artist);
    const sKey = sanitize(currentUser);

    setAllPicks((prev) => {
      const myP = { ...(prev[sKey] || {}) };
      const current = myP[key] || 0;
      myP[key] = (current + 1) % 3;

      // Debounced save to Firebase
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const toSave = { ...myP };
      saveTimer.current = setTimeout(() => savePicks(currentUser, toSave), 300);

      return { ...prev, [sKey]: myP };
    });
  }, [currentUser]);

  const handleClearAll = async () => {
    if (!currentUser) return;
    const sKey = sanitize(currentUser);
    setAllPicks((prev) => ({ ...prev, [sKey]: {} }));
    await clearPicksDB(currentUser);
    setShowConfirm(false);
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const totalSelected = Object.values(myPicks).filter((v) => v > 0).length;
  const mustSee = Object.values(myPicks).filter((v) => v === 2).length;
  const interested = totalSelected - mustSee;
  const getDayCount = (day) => Object.entries(myPicks).filter(([k, v]) => v > 0 && k.includes(`|${day}|`)).length;

  const scheduleData = useMemo(() => {
    const data = {};
    DAYS.forEach((day) => {
      data[day] = [];
      STAGE_NAMES.forEach((stage) => {
        (STAGES[stage][day] || []).forEach((artist) => {
          const level = myPicks[getKey(stage, day, artist)] || 0;
          if (level > 0) data[day].push({ artist, stage, level });
        });
      });
      data[day].sort((a, b) => b.level - a.level);
    });
    return data;
  }, [myPicks]);

  const stageBreakdown = useMemo(() => {
    const counts = {};
    STAGE_NAMES.forEach((s) => (counts[s] = 0));
    Object.entries(myPicks).forEach(([k, v]) => { if (v > 0) counts[k.split("|")[0]]++; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [myPicks]);
  const maxSC = Math.max(1, ...stageBreakdown.map((s) => s[1]));

  // Results: aggregate all members
  const resultsData = useMemo(() => {
    const artistMap = {};
    members.forEach((m, mi) => {
      const sKey = sanitize(m);
      const picks = allPicks[sKey] || {};
      Object.entries(picks).forEach(([k, v]) => {
        if (v > 0) {
          if (!artistMap[k]) {
            const parts = k.split("|");
            artistMap[k] = { artist: parts.slice(2).join("|"), stage: parts[0], day: parts[1], voters: [], totalScore: 0 };
          }
          artistMap[k].voters.push({ name: m, level: v, color: COLORS[mi % COLORS.length] });
          artistMap[k].totalScore += v;
        }
      });
    });
    return Object.values(artistMap).sort((a, b) => b.totalScore - a.totalScore || b.voters.length - a.voters.length);
  }, [allPicks, members]);

  const filteredResults = useMemo(() => {
    if (resultsFilter === "must") return resultsData.filter((r) => r.voters.some((v) => v.level === 2));
    if (resultsFilter === "interested") return resultsData.filter((r) => r.voters.every((v) => v.level === 1));
    return resultsData;
  }, [resultsData, resultsFilter]);

  const memberColor = (name) => COLORS[(members.indexOf(name) >= 0 ? members.indexOf(name) : 0) % COLORS.length];

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center">
        <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
          ULTRA <span style={{ background: "linear-gradient(135deg,#FBBF24,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>2026</span>
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: 14 }}>Loading...</p>
      </div>
    </div>
  );

  // ─── Welcome ──────────────────────────────────────────────────────────────
  if (!currentUser) return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 15% 0%,rgba(251,191,36,0.035) 0%,transparent 55%),radial-gradient(ellipse at 85% 0%,rgba(249,115,22,0.025) 0%,transparent 55%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500, letterSpacing: 4, color: "var(--orange)", opacity: 0.75, marginBottom: 6 }}>MIAMI · MARCH 27–29</div>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color: "#fff", lineHeight: 1, marginBottom: 10 }}>
            ULTRA <span style={{ background: "linear-gradient(135deg,#FBBF24,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>2026</span>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
          <div style={{ textAlign: "center", maxWidth: 380, width: "90%" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>What's your name?</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>Enter your name to start picking sets. Share this link with your crew so everyone can vote.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Your name..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinAs(nameInput)}
                autoFocus
                style={{
                  flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-l)", borderRadius: 100,
                  padding: "12px 20px", color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: 15, outline: "none",
                }}
              />
              <button
                onClick={() => joinAs(nameInput)}
                disabled={!nameInput.trim()}
                style={{
                  padding: "12px 28px", borderRadius: 100, border: "none",
                  background: "linear-gradient(135deg,#FBBF24,#F97316)", color: "#000", fontWeight: 700,
                  fontSize: 14, cursor: nameInput.trim() ? "pointer" : "not-allowed", fontFamily: "'Outfit',sans-serif",
                  opacity: nameInput.trim() ? 1 : 0.4, whiteSpace: "nowrap",
                }}
              >Let's go</button>
            </div>
            {members.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, letterSpacing: 1 }}>OR CONTINUE AS</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                  {members.map((m, i) => (
                    <button
                      key={m} onClick={() => joinAs(m)}
                      style={{
                        padding: "7px 16px", borderRadius: 100, border: `1px solid ${COLORS[i % COLORS.length]}33`,
                        background: `${COLORS[i % COLORS.length]}15`, color: COLORS[i % COLORS.length],
                        cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 13, fontWeight: 500,
                      }}
                    >{m}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Main App ─────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 15% 0%,rgba(251,191,36,0.035) 0%,transparent 55%),radial-gradient(ellipse at 85% 0%,rgba(249,115,22,0.025) 0%,transparent 55%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", padding: "20px 16px 88px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500, letterSpacing: 4, color: "var(--orange)", opacity: 0.75, marginBottom: 6 }}>MIAMI · MARCH 27–29</div>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color: "#fff", lineHeight: 1, marginBottom: 10 }}>
            ULTRA <span style={{ background: "linear-gradient(135deg,#FBBF24,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>2026</span>
          </h1>
          {tab === "heatmap" && (
            <div style={{ fontSize: 12.5, color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: "rgba(251,191,36,0.5)" }} /> Tap = Interested
              </span>
              <span style={{ color: "var(--text-3)", margin: "0 2px" }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, background: "rgba(249,115,22,0.85)" }} /> Tap again = Must see
              </span>
              <span style={{ color: "var(--text-3)", margin: "0 2px" }}>·</span>
              <span>Tap again = Clear</span>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
            Logged in as <span style={{ color: memberColor(currentUser), fontWeight: 600 }}>{currentUser}</span>
            <span onClick={() => setCurrentUser(null)} style={{ marginLeft: 8, color: "var(--text-3)", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}>switch</span>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 20, background: "var(--bg-card)", borderRadius: 100, padding: 3, width: "fit-content", marginLeft: "auto", marginRight: "auto", border: "1px solid var(--border)" }}>
          {[{ id: "heatmap", l: "Heatmap" }, { id: "schedule", l: "My Schedule" }, { id: "results", l: "Results" }].map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: "8px 22px", border: "none", background: tab === t.id ? "rgba(249,115,22,0.15)" : "transparent",
                color: tab === t.id ? "var(--yellow)" : "var(--text-2)", cursor: "pointer", fontFamily: "'Outfit',sans-serif",
                fontSize: 13, fontWeight: 500, borderRadius: 100, letterSpacing: 0.3,
                boxShadow: tab === t.id ? "0 0 16px rgba(249,115,22,0.08)" : "none",
                transition: "all .25s cubic-bezier(.16,1,.3,1)",
              }}
            >{t.l}</button>
          ))}
        </div>

        {/* ═══ HEATMAP TAB ═══ */}
        {tab === "heatmap" && (
          <>
            {/* Stats */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 100, background: "var(--bg-card)", border: "1px solid var(--yellow-border)", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--yellow)" }}>{interested}</span>
                <span style={{ color: "var(--text-2)" }}>interested</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 100, background: "var(--bg-card)", border: "1px solid var(--orange-border)", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "var(--orange)" }}>{mustSee}</span>
                <span style={{ color: "var(--text-2)" }}>must see</span>
              </div>
              {totalSelected > 0 && (
                <button onClick={() => setShowConfirm(true)} style={{ padding: "6px 14px", borderRadius: 100, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "#F87171", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 500 }}>
                  Clear all
                </button>
              )}
            </div>

            {/* Day tabs */}
            <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 20 }}>
              {DAYS.map((d) => {
                const n = getDayCount(d);
                const isOn = activeDay === d;
                return (
                  <button key={d} onClick={() => setActiveDay(d)} style={{
                    position: "relative", padding: "9px 24px", border: `1px solid ${isOn ? "rgba(249,115,22,0.35)" : "var(--border)"}`,
                    background: isOn ? "linear-gradient(135deg,rgba(251,191,36,0.12),rgba(249,115,22,0.12))" : "rgba(255,255,255,0.02)",
                    color: isOn ? "var(--yellow)" : "var(--text-2)", cursor: "pointer", fontFamily: "'Outfit',sans-serif",
                    fontSize: 12.5, fontWeight: 600, letterSpacing: 1, borderRadius: 100, outline: "none",
                    transition: "all .3s cubic-bezier(.16,1,.3,1)",
                  }}>
                    {DAY_LABELS[d]}
                    {n > 0 && (
                      <span style={{
                        position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 100,
                        background: "linear-gradient(135deg,#FBBF24,#F97316)", color: "#000", fontSize: 9, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{n}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            <div style={{ overflowX: "auto", paddingBottom: 4 }}>
              <div key={activeDay} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(138px, 1fr))", gap: 3, minWidth: 970 }}>
                {STAGE_NAMES.map((s) => (
                  <div key={s} style={{
                    padding: "12px 6px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5,
                    fontWeight: 600, letterSpacing: 2, color: "var(--text-2)", textTransform: "uppercase",
                    borderBottom: "1px solid var(--border)", background: "var(--bg)", position: "sticky", top: 0, zIndex: 2,
                  }}>{s}</div>
                ))}
                {(() => {
                  const max = Math.max(...STAGE_NAMES.map((s) => (STAGES[s][activeDay] || []).length));
                  const rows = [];
                  for (let i = 0; i < max; i++) {
                    STAGE_NAMES.forEach((stage, si) => {
                      const artists = STAGES[stage][activeDay] || [];
                      const artist = artists[i];
                      if (artist) {
                        const key = getKey(stage, activeDay, artist);
                        const level = myPicks[key] || 0;
                        const isY = level === 1, isO = level === 2;
                        rows.push(
                          <div
                            key={`${stage}-${activeDay}-${i}`}
                            onClick={() => handleClick(stage, activeDay, artist)}
                            style={{
                              padding: "11px 7px", minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center",
                              textAlign: "center", cursor: "pointer", userSelect: "none", borderRadius: "var(--r)",
                              border: `1px solid ${isO ? "var(--orange-border)" : isY ? "var(--yellow-border)" : "transparent"}`,
                              background: isO ? "var(--orange-bg)" : isY ? "var(--yellow-bg)" : "var(--bg-card)",
                              fontSize: artist.length > 28 ? 9 : artist.length > 18 ? 10 : 11,
                              fontWeight: isO ? 600 : isY ? 500 : 400,
                              color: isO ? "#fff" : isY ? "#FDE68A" : "var(--text-2)",
                              lineHeight: 1.3, letterSpacing: 0.3,
                              boxShadow: isO ? "0 0 20px var(--orange-glow)" : "none",
                              transition: "all .2s cubic-bezier(.16,1,.3,1)",
                              animation: `fadeUp .3s cubic-bezier(.16,1,.3,1) ${(i * 7 + si) * 12}ms both`,
                            }}
                          >{artist}</div>
                        );
                      } else {
                        rows.push(<div key={`${stage}-${activeDay}-${i}-e`} style={{ minHeight: 52 }} />);
                      }
                    });
                  }
                  return rows;
                })()}
              </div>
            </div>
          </>
        )}

        {/* ═══ SCHEDULE TAB ═══ */}
        {tab === "schedule" && (
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {totalSelected === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-3)" }}>
                <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>🎧</div>
                <div style={{ fontSize: 14 }}>No sets selected yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Head to the Heatmap tab to start picking</div>
              </div>
            ) : (
              <>
                {DAYS.map((day) => {
                  const items = scheduleData[day];
                  if (!items.length) return null;
                  return (
                    <div key={day} style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "var(--text-2)", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                        {DAY_FULL[day]}
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: "var(--orange)", background: "rgba(249,115,22,0.12)", padding: "2px 10px", borderRadius: 100 }}>{items.length} sets</span>
                      </div>
                      {items.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: "var(--r)", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 4 }}>
                          <div style={{ width: 5, height: 30, borderRadius: 3, flexShrink: 0, background: item.level === 2 ? "var(--orange)" : "var(--yellow)" }} />
                          <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{item.artist}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 500, letterSpacing: 1, color: "var(--text-3)", textTransform: "uppercase", background: "var(--bg-raised)", padding: "3px 10px", borderRadius: 100 }}>{item.stage}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div style={{ maxWidth: 800, margin: "32px auto 0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: "var(--text-3)", marginBottom: 14, textTransform: "uppercase" }}>Stage Breakdown</div>
                  {stageBreakdown.filter((s) => s[1] > 0).map(([stage, count]) => (
                    <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 7 }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: 1, color: "var(--text-2)", width: 120, textAlign: "right", flexShrink: 0, textTransform: "uppercase" }}>{stage}</div>
                      <div style={{ flex: 1, height: 22, background: "var(--bg-card)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 6, width: `${(count / maxSC) * 100}%`, background: "linear-gradient(90deg,var(--yellow),var(--orange))", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: "fit-content", transition: "width .6s cubic-bezier(.16,1,.3,1)" }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.7)" }}>{count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ RESULTS TAB ═══ */}
        {tab === "results" && (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            {/* Members */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {members.map((m, i) => {
                const count = Object.values(allPicks[sanitize(m)] || {}).filter((v) => v > 0).length;
                return (
                  <div key={m} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 100, background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-2)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#000", background: COLORS[i % COLORS.length] }}>{m[0].toUpperCase()}</span>
                    {m}
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-3)" }}>{count}</span>
                  </div>
                );
              })}
            </div>

            {resultsData.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-3)" }}>
                <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>📊</div>
                <div style={{ fontSize: 14 }}>No picks yet</div>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 28 }}>
                  <div style={{ padding: "20px 16px", borderRadius: "var(--r)", background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: "var(--text)" }}>{resultsData.length}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: 1, textTransform: "uppercase" }}>Artists Picked</div>
                  </div>
                  <div style={{ padding: "20px 16px", borderRadius: "var(--r)", background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: "var(--orange)" }}>{members.length}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: 1, textTransform: "uppercase" }}>Voters</div>
                  </div>
                  <div style={{ padding: "20px 16px", borderRadius: "var(--r)", background: "var(--bg-card)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: "var(--yellow)" }}>
                      {resultsData.filter((r) => r.voters.length === members.length && members.length > 1).length}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: 1, textTransform: "uppercase" }}>Unanimous</div>
                  </div>
                </div>

                {/* Filter */}
                <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 20 }}>
                  {[{ id: "all", l: "All" }, { id: "must", l: "Has Must-See" }, { id: "interested", l: "Interested Only" }].map((f) => (
                    <button key={f.id} onClick={() => setResultsFilter(f.id)} style={{
                      padding: "6px 16px", border: `1px solid ${resultsFilter === f.id ? "rgba(249,115,22,0.3)" : "var(--border)"}`,
                      background: resultsFilter === f.id ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.02)",
                      color: resultsFilter === f.id ? "var(--yellow)" : "var(--text-3)", cursor: "pointer",
                      fontFamily: "'Outfit',sans-serif", fontSize: 11.5, fontWeight: 500, borderRadius: 100,
                    }}>{f.l}</button>
                  ))}
                </div>

                {/* Ranked list */}
                {filteredResults.map((item, idx) => {
                  const pct = Math.round((item.totalScore / (members.length * 2)) * 100);
                  const hasMust = item.voters.some((v) => v.level === 2);
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: idx < 3 ? "var(--orange)" : "var(--text-3)", width: 28, textAlign: "center", flexShrink: 0 }}>{idx + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.artist}</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1, display: "flex", gap: 8 }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5 }}>{item.stage}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5 }}>{DAY_FULL[item.day]}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                        {item.voters.map((v, vi) => (
                          <div key={vi} title={`${v.name}: ${v.level === 2 ? "Must see" : "Interested"}`} style={{
                            width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 7, fontWeight: 700, color: v.level === 2 ? "#000" : v.color,
                            background: v.level === 2 ? v.color : `${v.color}33`, border: `1.5px solid ${v.color}`,
                          }}>{v.name[0].toUpperCase()}</div>
                        ))}
                      </div>
                      <div style={{ width: 200, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: "var(--bg-card)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 4, width: `${pct}%`, background: hasMust ? "linear-gradient(90deg,#F97316,#EF4444)" : "linear-gradient(90deg,#FBBF24,#F97316)", transition: "width .5s cubic-bezier(.16,1,.3,1)" }} />
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, width: 40, textAlign: "right", color: hasMust ? "var(--orange)" : "var(--yellow)" }}>{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(8,8,12,0.92)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: "1px solid var(--border)",
        padding: "11px 20px", display: "flex", justifyContent: "center", alignItems: "center", gap: 24, zIndex: 10,
        transform: tab === "heatmap" && totalSelected > 0 ? "translateY(0)" : "translateY(100%)",
        transition: "transform .4s cubic-bezier(.16,1,.3,1)",
      }}>
        {DAYS.map((d) => { const n = getDayCount(d); return <span key={d} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: n > 0 ? "var(--text-2)" : "var(--text-3)" }}>{DAY_FULL[d]} <span style={{ fontWeight: 700, color: n > 0 ? "var(--yellow)" : "inherit" }}>{n}</span></span>; })}
        <div style={{ width: 1, height: 14, background: "var(--border)" }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#FBBF24,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{totalSelected} SETS</span>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div onClick={() => setShowConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#131318", border: "1px solid var(--border-l)", borderRadius: 16, padding: "28px 32px", textAlign: "center", maxWidth: 340, width: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Clear all selections?</h3>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>This will remove all {totalSelected} of your picks.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setShowConfirm(false)} style={{ padding: "8px 24px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--bg-raised)", color: "var(--text-2)", border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={handleClearAll} style={{ padding: "8px 24px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.9)", color: "#fff", border: "none" }}>Clear all</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
