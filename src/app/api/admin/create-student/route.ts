import { NextResponse } from "next/server";
import { adminAuth, adminDb, firebaseAdminReady } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  if (!firebaseAdminReady || !adminAuth || !adminDb) {
    return NextResponse.json(
      { error: "Firebase Admin env missing. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in Vercel." },
      { status: 501 }
    );
  }

  const { email, password, displayName, student } = await request.json();

  if (!email || !password || !displayName || !student) {
    return NextResponse.json({ error: "Student email, password and profile are required." }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Student password kam se kam 6 characters ka hona chahiye." }, { status: 400 });
  }

  let userRecord;
  try {
    userRecord = await adminAuth.createUser({
      email,
      password,
      displayName
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to create Firebase user.";
    if (!message.includes("email-already-exists")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    userRecord = await adminAuth.getUserByEmail(email);
  }
  await adminAuth.setCustomUserClaims(userRecord.uid, { role: "student" });

  const { password: _password, ...safeStudent } = student;

  const profile = {
    ...safeStudent,
    id: userRecord.uid,
    uid: userRecord.uid,
    role: "student",
    createdAt: new Date().toISOString()
  };

  await adminDb.collection("students").doc(userRecord.uid).set(profile, { merge: true });
  await adminDb.collection("users").doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    role: "student",
    studentId: student.studentId,
    displayName,
    createdAt: new Date().toISOString()
  }, { merge: true });

  return NextResponse.json({ uid: userRecord.uid });
}
