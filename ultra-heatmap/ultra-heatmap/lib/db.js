import { db } from "./firebase";
import { ref, set, get, onValue, off } from "firebase/database";

// Sanitize name for use as Firebase key (no . $ # [ ] /)
function sanitize(name) {
  return name.toLowerCase().replace(/[.$#\[\]\/\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "user";
}

// ─── Members ────────────────────────────────────────────────────────────────

export async function addMember(name) {
  const key = sanitize(name);
  const memberRef = ref(db, `members/${key}`);
  await set(memberRef, { name, joinedAt: Date.now() });
}

export async function getMembers() {
  const snap = await get(ref(db, "members"));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.values(data).map((m) => m.name);
}

export function onMembersChange(callback) {
  const membersRef = ref(db, "members");
  onValue(membersRef, (snap) => {
    if (!snap.exists()) return callback([]);
    const data = snap.val();
    callback(Object.values(data).map((m) => m.name));
  });
  return () => off(membersRef);
}

// ─── Picks ──────────────────────────────────────────────────────────────────

export async function savePicks(name, picks) {
  const key = sanitize(name);
  await set(ref(db, `picks/${key}`), picks);
}

export async function getPicks(name) {
  const key = sanitize(name);
  const snap = await get(ref(db, `picks/${key}`));
  return snap.exists() ? snap.val() : {};
}

export function onAllPicksChange(callback) {
  const picksRef = ref(db, "picks");
  onValue(picksRef, (snap) => {
    if (!snap.exists()) return callback({});
    callback(snap.val());
  });
  return () => off(picksRef);
}

export async function clearPicks(name) {
  const key = sanitize(name);
  await set(ref(db, `picks/${key}`), {});
}
