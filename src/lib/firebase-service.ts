import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Complaint, Notice, Room, SiteSettings, Student } from "./types";

export const collections = {
  users: "users",
  students: "students",
  rooms: "rooms",
  notices: "notices",
  complaints: "complaints",
  settings: "settings",
  payments: "payments"
};

export function listenCollection<T>(name: string, callback: (items: T[]) => void) {
  if (!db) return () => undefined;
  return onSnapshot(query(collection(db, name), orderBy("createdAt", "desc")), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
  });
}

export async function saveStudent(student: Student) {
  if (!db) throw new Error("Firebase is not configured.");
  await setDoc(doc(db, collections.students, student.id), student, { merge: true });
}

export async function saveRoom(room: Room) {
  if (!db) throw new Error("Firebase is not configured.");
  await setDoc(doc(db, collections.rooms, room.id), room, { merge: true });
}

export async function saveNotice(notice: Notice) {
  if (!db) throw new Error("Firebase is not configured.");
  await setDoc(doc(db, collections.notices, notice.id), notice, { merge: true });
}

export async function updateComplaint(id: string, data: Partial<Complaint>) {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, collections.complaints, id), data);
}

export async function saveSettings(settings: SiteSettings) {
  if (!db) throw new Error("Firebase is not configured.");
  await setDoc(doc(db, collections.settings, "site"), settings, { merge: true });
}
