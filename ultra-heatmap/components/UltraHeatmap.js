"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { STAGES, DAYS, DAY_LABELS, DAY_FULL, STAGE_NAMES, COLORS } from "@/lib/data";
import { addMember, getMembers, onMembersChange, savePicks, onAllPicksChange, clearPicks, deleteMember as deleteMemberDB } from "@/lib/db";

function heatBg(t) { if (t <= 0) return "rgba(255,255,255,0.02)"; if (t < .15) return "rgba(251,191,36," + (.06 + t * .3) + ")"; if (t < .35) return "rgba(245,158,11," + (.08 + t * .45) + ")"; if (t < .6) return "rgba(249,115,22," + (.1 + t * .45) + ")"; if (t < .85) return "rgba(239,68,68," + (.12 + t * .4) + ")"; return "rgba(239,68,68," + (.2 + t * .45) + ")"; }
function heatBorder(t) { if (t <= 0) return "transparent"; if (t < .3) return "rgba(251,191,36," + (.15 + t * .5) + ")"; if (t < .6) return "rgba(249,115,22," + (.2 + t * .5) + ")"; return "rgba(239,68,68," + (.25 + t * .5) + ")"; }
function heatText(t) { if (t <= 0) return "rgba(255,255,255,0.28)"; if (t < .3) return "rgba(253,230,138," + (.6 + t) + ")"; if (t < .6) return "rgba(255,200,120," + (.7 + t * .3) + ")"; return "#fff"; }
function heatGlow(t) { if (t < .4) return "none"; if (t < .7) return "0 0 16px rgba(249,115,22," + (t * .2) + ")"; return "0 0 24px rgba(239,68,68," + (t * .25) + ")"; }

function sanitize(name) {
  return name.toLowerCase().replace(/[.$#\[\]\/\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "user";
}

const S = {
  app: { background: "#06060a", minHeight: "100vh", position: "relative", fontFamily: "'Outfit',sans-serif" },
  glow: { position: "fixed", inset: 0, background: "radial-gradient(ellipse at 15% 0%,rgba(251,191,36,0.04) 0%,transparent 55%),radial-gradient(ellipse at 85% 0%,rgba(249,115,22,0.03) 0%,transparent 55%)", pointerEvents: "none", zIndex: 0 },
  wrap: { position: "relative", zIndex: 1, maxWidth: 1320, margin: "0 auto", padding: "16px 16px 80px" },
  mono: { fontFamily: "'JetBrains Mono', monospace" },
};

const FONT = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap";

export default function UltraHeatmap() {
  const [currentUser, setCurrentUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [members, setMembers] = useState({});
  const [allPicks, setAllPicks] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState("fri");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const saveTimer = useRef(null);

  // Real-time Firebase listeners
  useEffect(() => {
    let unsubM, unsubP;
    const init = async () => {
      unsubM = onMembersChange((m) => {
        // Assign colors to members
        const colored = {};
        Object.entries(m).forEach(([k, v], i) => {
          colored[k] = { ...v, color: COLORS[i % COLORS.length] };
        });
        setMembers(colored);
      });
      unsubP = onAllPicksChange((p) => {
        setAllPicks(prev => {
          const merged = { ...p };
          // Keep local user's unsaved picks
          if (currentUser && prev[sanitize(currentUser)]) {
            merged[sanitize(currentUser)] = prev[sanitize(currentUser)];
          }
          return merged;
        });
      });
      setLoading(false);
    };
    init();
    return () => { if (unsubM) unsubM(); if (unsubP) unsubP(); };
  }, []);

  const joinAs = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = sanitize(trimmed);
    await addMember(trimmed);
    setCurrentUser(key);
  };

  const handleDeleteMember = async (key) => {
    const name = members[key]?.name || key;
    await deleteMemberDB(name);
    if (currentUser === key) setCurrentUser(null);
    setDeleteTarget(null);
  };

  const getKey = (s, d, a) => s + "|" + d + "|" + a;
  const memberKeys = Object.keys(members);
  const memberCount = Math.max(1, memberKeys.length);
  const myKey = currentUser ? sanitize(currentUser) : null;
  const myPicks = myKey ? (allPicks[myKey] || {}) : {};

  const handleClick = useCallback((stage, day, artist) => {
    if (!myKey) return;
    const key = getKey(stage, day, artist);
    setAllPicks(prev => {
      const next = { ...prev };
      const my = { ...(next[myKey] || {}) };
      my[key] = ((my[key] || 0) + 1) % 3;
      next[myKey] = my;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const toSave = { ...my };
      saveTimer.current = setTimeout(() => savePicks(members[myKey]?.name || myKey, toSave), 300);
      return next;
    });
  }, [myKey, members]);

  const handleClear = async () => {
    if (!myKey) return;
    setAllPicks(prev => ({ ...prev, [myKey]: {} }));
    await clearPicks(members[myKey]?.name || myKey);
    setShowConfirm(false);
  };

  const getCellData = useCallback((stage, day, artist) => {
    const key = getKey(stage, day, artist);
    let totalScore = 0;
    const voters = [];
    memberKeys.forEach(mk => {
      const level = (allPicks[mk] || {})[key] || 0;
      if (level > 0) {
        totalScore += level;
        voters.push({ key: mk, name: members[mk]?.name || mk, color: members[mk]?.color || "#888", level });
      }
    });
    const intensity = memberCount > 0 ? totalScore / (memberCount * 2) : 0;
    return { intensity, voters };
  }, [allPicks, members, memberKeys, memberCount]);

  const totalSelected = Object.values(myPicks).filter(v => v > 0).length;
  const getDayCount = (day) => Object.entries(myPicks).filter(([k, v]) => v > 0 && k.includes("|" + day + "|")).length;
  const myColor = myKey ? (members[myKey]?.color || "#F97316") : "#F97316";
  const myInitial = myKey ? (members[myKey]?.name?.[0]?.toUpperCase() || "?") : "?";

  if (loading) {
    return React.createElement("div", { style: { ...S.app, display: "flex", alignItems: "center", justifyContent: "center" } },
      React.createElement("link", { rel: "stylesheet", href: FONT }),
      React.createElement("p", { style: { color: "rgba(255,255,255,0.28)" } }, "Loading...")
    );
  }

  if (!currentUser) {
    return React.createElement("div", { style: S.app },
      React.createElement("link", { rel: "stylesheet", href: FONT }),
      React.createElement("div", { style: S.glow }),
      React.createElement("div", { style: { position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 } },
        React.createElement("div", { style: { textAlign: "center", marginBottom: 40 } },
          React.createElement("div", { style: { ...S.mono, fontSize: 10, fontWeight: 500, letterSpacing: 4, color: "#F97316", opacity: .7, marginBottom: 6 } }, "MIAMI · MARCH 27–29"),
          React.createElement("h1", { style: { fontSize: 42, fontWeight: 900, letterSpacing: -1, color: "#fff", lineHeight: 1 } }, "ULTRA ", React.createElement("span", { style: { background: "linear-gradient(135deg,#FBBF24,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } }, "2026"))
        ),
        React.createElement("div", { style: { textAlign: "center", maxWidth: 360, width: "100%" } },
          React.createElement("h2", { style: { fontSize: 20, fontWeight: 700, marginBottom: 6 } }, "Enter your name"),
          React.createElement("p", { style: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.5 } }, "Pick who you want to see. The heatmap updates live as your crew votes."),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { placeholder: "Your name...", value: nameInput, onChange: (e) => setNameInput(e.target.value), onKeyDown: (e) => e.key === "Enter" && joinAs(nameInput), autoFocus: true, style: { flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "13px 18px", color: "#f0f0f0", fontFamily: "'Outfit',sans-serif", fontSize: 15, outline: "none" } }),
            React.createElement("button", { onClick: () => joinAs(nameInput), disabled: !nameInput.trim(), style: { padding: "13px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#FBBF24,#F97316)", color: "#000", fontWeight: 700, fontSize: 14, cursor: nameInput.trim() ? "pointer" : "not-allowed", fontFamily: "'Outfit',sans-serif", opacity: nameInput.trim() ? 1 : .35, whiteSpace: "nowrap" } }, "Go")
          ),
          memberKeys.length > 0 && React.createElement("div", { style: { marginTop: 28 } },
            React.createElement("div", { style: { fontSize: 10, color: "rgba(255,255,255,0.28)", marginBottom: 8, letterSpacing: 1.5 } }, memberKeys.length + (memberKeys.length === 1 ? " PERSON" : " PEOPLE") + " VOTING"),
            React.createElement("div", { style: { display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" } },
              memberKeys.map(mk => React.createElement("div", { key: mk, title: members[mk]?.name, style: { width: 28, height: 28, borderRadius: "50%", background: (members[mk]?.color || "#888") + "22", border: "1.5px solid " + (members[mk]?.color || "#888") + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: members[mk]?.color } }, members[mk]?.name?.[0]?.toUpperCase()))
            )
          )
        )
      )
    );
  }

  const renderGrid = () => {
    const max = Math.max(...STAGE_NAMES.map(s => (STAGES[s][activeDay] || []).length));
    const cells = [];
    for (let i = 0; i < max; i++) {
      STAGE_NAMES.forEach((stage, si) => {
        const artists = STAGES[stage][activeDay] || [];
        const artist = artists[i];
        if (artist) {
          const { intensity, voters } = getCellData(stage, activeDay, artist);
          const sorted = [...voters].sort((a, b) => (a.key === myKey ? -1 : b.key === myKey ? 1 : 0));
          cells.push(React.createElement("div", {
            key: stage + "-" + activeDay + "-" + i,
            onClick: () => handleClick(stage, activeDay, artist),
            style: { padding: "11px 7px", minHeight: 54, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer", userSelect: "none", borderRadius: 10, position: "relative", border: "1px solid " + heatBorder(intensity), background: heatBg(intensity), fontSize: artist.length > 28 ? 9 : artist.length > 18 ? 10 : 11, fontWeight: intensity > .5 ? 600 : intensity > .2 ? 500 : 400, color: heatText(intensity), lineHeight: 1.3, letterSpacing: .3, boxShadow: heatGlow(intensity), transition: "all .35s cubic-bezier(.16,1,.3,1)" }
          },
            artist,
            sorted.length > 0 && React.createElement("div", { style: { position: "absolute", top: 3, right: 3, display: "flex", flexDirection: "row-reverse", gap: 0 } },
              sorted.slice(0, 5).reverse().map((v, vi) => React.createElement("div", { key: vi, title: v.name + ": " + (v.level === 2 ? "Must see" : "Interested"), style: { width: 14, height: 14, borderRadius: "50%", background: v.level === 2 ? v.color : v.color + "44", border: "1.5px solid " + v.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: v.level === 2 ? "#000" : v.color, marginLeft: vi > 0 ? -4 : 0, zIndex: sorted.length - vi } }, v.name[0]?.toUpperCase())),
              sorted.length > 5 && React.createElement("div", { style: { width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginLeft: -4 } }, "+" + (sorted.length - 5))
            )
          ));
        } else {
          cells.push(React.createElement("div", { key: stage + "-" + activeDay + "-" + i + "-e", style: { minHeight: 54 } }));
        }
      });
    }
    return cells;
  };

  return React.createElement("div", { style: S.app },
    React.createElement("link", { rel: "stylesheet", href: FONT }),
    React.createElement("div", { style: S.glow }),
    React.createElement("div", { style: S.wrap },

      // Header
      React.createElement("div", { style: { textAlign: "center", marginBottom: 16 } },
        React.createElement("div", { style: { ...S.mono, fontSize: 9, fontWeight: 500, letterSpacing: 4, color: "#F97316", opacity: .65, marginBottom: 4 } }, "MIAMI · MARCH 27–29"),
        React.createElement("h1", { style: { fontSize: 30, fontWeight: 900, letterSpacing: -1, color: "#fff", lineHeight: 1, marginBottom: 8 } }, "ULTRA ", React.createElement("span", { style: { background: "linear-gradient(135deg,#FBBF24,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } }, "2026")),
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 4 } },
            [.05, .2, .4, .65, .9].map((v, i) => React.createElement("div", { key: i, style: { width: 16, height: 16, borderRadius: 3, background: heatBg(v), border: "1px solid " + heatBorder(v) } })),
            React.createElement("span", { style: { fontSize: 10, color: "rgba(255,255,255,0.28)", marginLeft: 4 } }, "cold → hot")
          )
        ),
        React.createElement("div", { style: { fontSize: 11.5, color: "rgba(255,255,255,0.28)", marginBottom: 6 } }, "Tap once = interested · Tap again = must see · Tap again = clear"),
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, flexWrap: "wrap" } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 5 } },
            React.createElement("div", { style: { width: 22, height: 22, borderRadius: "50%", background: myColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#000" } }, myInitial),
            React.createElement("span", { style: { fontSize: 12, color: myColor, fontWeight: 600 } }, members[myKey]?.name)
          ),
          memberKeys.filter(mk => mk !== myKey).length > 0 && React.createElement("span", { style: { color: "rgba(255,255,255,0.1)" } }, "·"),
          React.createElement("div", { style: { display: "flex", gap: 3 } },
            memberKeys.filter(mk => mk !== myKey).map(mk => React.createElement("div", { key: mk, title: members[mk]?.name, style: { width: 20, height: 20, borderRadius: "50%", background: (members[mk]?.color || "#888") + "33", border: "1.5px solid " + (members[mk]?.color || "#888") + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: members[mk]?.color } }, members[mk]?.name?.[0]?.toUpperCase()))
          ),
          React.createElement("span", { style: { color: "rgba(255,255,255,0.1)" } }, "·"),
          React.createElement("span", { onClick: () => setCurrentUser(null), style: { fontSize: 10, color: "rgba(255,255,255,0.28)", cursor: "pointer", textDecoration: "underline" } }, "switch"),
          myKey === "andy" && React.createElement("span", { onClick: () => setShowManage(true), style: { fontSize: 10, color: "rgba(255,255,255,0.28)", cursor: "pointer", textDecoration: "underline" } }, "manage")
        )
      ),

      // Day tabs
      React.createElement("div", { style: { display: "flex", justifyContent: "center", gap: 5, marginBottom: 16 } },
        DAYS.map(d => {
          const n = getDayCount(d); const on = activeDay === d;
          return React.createElement("button", { key: d, onClick: () => setActiveDay(d), style: { position: "relative", padding: "8px 22px", border: "1px solid " + (on ? "rgba(249,115,22,0.35)" : "rgba(255,255,255,0.05)"), background: on ? "linear-gradient(135deg,rgba(251,191,36,0.1),rgba(249,115,22,0.1))" : "rgba(255,255,255,0.015)", color: on ? "#FBBF24" : "rgba(255,255,255,0.28)", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 1, borderRadius: 100, outline: "none", transition: "all .3s" } },
            DAY_LABELS[d],
            n > 0 && React.createElement("span", { style: { position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 100, background: "linear-gradient(135deg,#FBBF24,#F97316)", color: "#000", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" } }, n)
          );
        })
      ),

      totalSelected > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "center", marginBottom: 12 } },
        React.createElement("button", { onClick: () => setShowConfirm(true), style: { padding: "5px 14px", borderRadius: 100, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#F87171", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: 10, fontWeight: 500 } }, "Clear my picks")
      ),

      // Grid
      React.createElement("div", { style: { overflowX: "auto", paddingBottom: 4 } },
        React.createElement("div", { key: activeDay, style: { display: "grid", gridTemplateColumns: "repeat(7,minmax(138px,1fr))", gap: 3, minWidth: 970 } },
          STAGE_NAMES.map(s => React.createElement("div", { key: s, style: { ...S.mono, padding: "11px 6px", textAlign: "center", fontSize: 9, fontWeight: 600, letterSpacing: 2, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#06060a", position: "sticky", top: 0, zIndex: 2 } }, s)),
          renderGrid()
        )
      )
    ),

    // Bottom bar
    React.createElement("div", { style: { position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(6,6,10,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 20px", display: "flex", justifyContent: "center", alignItems: "center", gap: 20, zIndex: 10, transform: totalSelected > 0 ? "translateY(0)" : "translateY(100%)", transition: "transform .4s cubic-bezier(.16,1,.3,1)" } },
      DAYS.map(d => { const n = getDayCount(d); return React.createElement("span", { key: d, style: { ...S.mono, fontSize: 10, color: n > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)" } }, DAY_FULL[d] + " ", React.createElement("span", { style: { fontWeight: 700, color: n > 0 ? "#FBBF24" : "inherit" } }, n)); }),
      React.createElement("div", { style: { width: 1, height: 12, background: "rgba(255,255,255,0.05)" } }),
      React.createElement("span", { style: { ...S.mono, fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#FBBF24,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } }, totalSelected + " SETS"),
      React.createElement("div", { style: { width: 1, height: 12, background: "rgba(255,255,255,0.05)" } }),
      React.createElement("span", { style: { ...S.mono, fontSize: 10, color: "rgba(255,255,255,0.28)" } }, memberKeys.length + " voting")
    ),

    // Clear confirm
    showConfirm && React.createElement("div", { onClick: () => setShowConfirm(false), style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 } },
      React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: "#111116", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "28px 32px", textAlign: "center", maxWidth: 340, width: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" } },
        React.createElement("h3", { style: { fontSize: 16, fontWeight: 700, marginBottom: 8 } }, "Clear all your picks?"),
        React.createElement("p", { style: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 20 } }, "This removes your " + totalSelected + " selections."),
        React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "center" } },
          React.createElement("button", { onClick: () => setShowConfirm(false), style: { padding: "8px 24px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.05)" } }, "Cancel"),
          React.createElement("button", { onClick: handleClear, style: { padding: "8px 24px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.9)", color: "#fff", border: "none" } }, "Clear all")
        )
      )
    ),

    // Manage modal
    showManage && React.createElement("div", { onClick: () => { setShowManage(false); setDeleteTarget(null); }, style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 } },
      React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: "#111116", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "24px 28px", maxWidth: 380, width: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" } },
        React.createElement("h3", { style: { fontSize: 16, fontWeight: 700, marginBottom: 4 } }, "Manage members"),
        React.createElement("p", { style: { fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 16 } }, "Remove a member to delete their name and all their picks."),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
          memberKeys.map(mk => {
            const m = members[mk]; const isMe = mk === myKey;
            const pickCount = Object.values(allPicks[mk] || {}).filter(v => v > 0).length;
            return React.createElement("div", { key: mk, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" } },
              React.createElement("div", { style: { width: 24, height: 24, borderRadius: "50%", background: m?.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#000", flexShrink: 0 } }, m?.name?.[0]?.toUpperCase()),
              React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 500 } }, m?.name, isMe && React.createElement("span", { style: { fontSize: 10, color: "rgba(255,255,255,0.28)", marginLeft: 6 } }, "(you)")),
                React.createElement("div", { style: { ...S.mono, fontSize: 10, color: "rgba(255,255,255,0.28)" } }, pickCount + " picks")
              ),
              deleteTarget === mk
                ? React.createElement("div", { style: { display: "flex", gap: 4 } },
                    React.createElement("button", { onClick: () => handleDeleteMember(mk), style: { padding: "4px 12px", borderRadius: 100, border: "none", background: "rgba(239,68,68,0.9)", color: "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif" } }, "Delete"),
                    React.createElement("button", { onClick: () => setDeleteTarget(null), style: { padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.05)", background: "transparent", color: "rgba(255,255,255,0.28)", fontSize: 10, cursor: "pointer", fontFamily: "'Outfit',sans-serif" } }, "Cancel")
                  )
                : React.createElement("button", { onClick: () => setDeleteTarget(mk), style: { padding: "4px 12px", borderRadius: 100, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#F87171", fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "'Outfit',sans-serif" } }, "Remove")
            );
          })
        ),
        React.createElement("div", { style: { display: "flex", justifyContent: "center", marginTop: 16 } },
          React.createElement("button", { onClick: () => { setShowManage(false); setDeleteTarget(null); }, style: { padding: "8px 24px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.05)", fontFamily: "'Outfit',sans-serif" } }, "Done")
        )
      )
    )
  );
}
