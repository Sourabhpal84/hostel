import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { ConnectedPgSite, MagneetozReferralEvent, SiteSettings } from "./types";

export const magneetozCollections = {
  settingsDoc: "centralMagneetoz/settings",
  events: "centralMagneetozEvents",
  connectedSites: "centralMagneetozSites"
};

export function listenCentralMagneetoz(callback: (magneetoz: SiteSettings["magneetoz"]) => void) {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, magneetozCollections.settingsDoc), (snapshot) => {
    const data = snapshot.data();
    if (data?.magneetoz) callback(data.magneetoz as SiteSettings["magneetoz"]);
  }, () => undefined);
}

export async function getCentralMagneetoz() {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, magneetozCollections.settingsDoc));
  const data = snapshot.data();
  return data?.magneetoz ? data.magneetoz as SiteSettings["magneetoz"] : null;
}

export async function saveCentralMagneetoz(magneetoz: SiteSettings["magneetoz"]) {
  if (!db) throw new Error("Firebase is not configured.");
  await setDoc(doc(db, magneetozCollections.settingsDoc), { magneetoz, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function trackCentralMagneetozEvent(event: Omit<MagneetozReferralEvent, "id">) {
  if (!db) return;
  await addDoc(collection(db, magneetozCollections.events), event);
}

export function listenMagneetozEvents(callback: (events: MagneetozReferralEvent[]) => void) {
  if (!db) return () => undefined;
  return onSnapshot(query(collection(db, magneetozCollections.events), orderBy("createdAt", "desc")), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MagneetozReferralEvent));
  }, () => undefined);
}

export function listenConnectedPgSites(callback: (sites: ConnectedPgSite[]) => void) {
  if (!db) return () => undefined;
  return onSnapshot(query(collection(db, magneetozCollections.connectedSites), orderBy("updatedAt", "desc")), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ConnectedPgSite));
  }, () => undefined);
}

export async function registerConnectedPgSite(site: ConnectedPgSite) {
  if (!db) throw new Error("Firebase is not configured.");
  const now = new Date().toISOString();
  await setDoc(doc(db, magneetozCollections.connectedSites, site.sourceId), {
    ...site,
    id: site.id || site.sourceId,
    sourceId: site.sourceId,
    status: site.status || "active",
    createdAt: site.createdAt || now,
    updatedAt: now
  }, { merge: true });
}
