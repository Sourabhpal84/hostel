import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export function listenPgSiteStore<T>(sourceId: string, callback: (store: Partial<T>) => void) {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, "pgSites", sourceId), (snapshot) => {
    const data = snapshot.data();
    if (data?.store) callback(data.store as Partial<T>);
  }, () => undefined);
}

export async function savePgSiteStore<T>(sourceId: string, store: T) {
  if (!db) return;
  await setDoc(doc(db, "pgSites", sourceId), {
    sourceId,
    store,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}
