import { db } from "./firebase";
import { ref, set, get, onValue, off } from "firebase/database";

function sanitize(name) {
  return name.toLowerCase().replace(/[.$#\[\]\/\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "user";
}

export async function addMember(name) {
  const key = sanitize(name);
  const snap = await get(ref(db, "members/" + key));
  if (!snap.exists()) {
    await set(ref(db, "members/" + key), { name, joinedAt: Date.now() });
  }
}

export async function getMembers() {
  const snap = await get(ref(db, "members"));
  if (!snap.exists()) return {};
  const data = snap.val();
  const result = {};
  Object.entries(data).forEach(([k, v]) => { result[k] = v; });
  return result;
}

export function onMembersChange(callback) {
  const r = ref(db, "members");
  onValue(r, (snap) => {
    if (!snap.exists()) return callback({});
    callback(snap.val());
  });
  return () => off(r);
}

export async function savePicks(name, picks) {
  const key = sanitize(name);
  await set(ref(db, "picks/" + key), picks);
}

export async function getPicks(name) {
  const key = sanitize(name);
  const snap = await get(ref(db, "picks/" + key));
  return snap.exists() ? snap.val() : {};
}

export function onAllPicksChange(callback) {
  const r = ref(db, "picks");
  onValue(r, (snap) => {
    if (!snap.exists()) return callback({});
    callback(snap.val());
  });
  return () => off(r);
}

export async function clearPicks(name) {
  const key = sanitize(name);
  await set(ref(db, "picks/" + key), {});
}

export async function deleteMember(name) {
  const key = sanitize(name);
  await set(ref(db, "members/" + key), null);
  await set(ref(db, "picks/" + key), null);
}
