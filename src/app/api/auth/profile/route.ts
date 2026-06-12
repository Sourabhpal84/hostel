import { NextResponse } from "next/server";
import { adminAuth, adminDb, firebaseAdminReady } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  if (!firebaseAdminReady || !adminAuth || !adminDb) {
    return NextResponse.json(
      { error: "Firebase Admin env missing. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY." },
      { status: 501 }
    );
  }

  const { token, expectedRole } = await request.json();
  if (!token) return NextResponse.json({ error: "Firebase ID token required." }, { status: 400 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userProfile = userSnap.exists ? userSnap.data() : null;
    const role = userProfile?.role || decoded.role || "";

    if (expectedRole && role !== expectedRole) {
      return NextResponse.json({ error: `This account is not a ${expectedRole} account.` }, { status: 403 });
    }

    if (expectedRole === "student") {
      const studentSnap = await adminDb.collection("students").doc(decoded.uid).get();
      if (!studentSnap.exists) {
        return NextResponse.json({ error: "Student profile Firestore me nahi mila. Admin admission dobara save kare." }, { status: 404 });
      }
      return NextResponse.json({ uid: decoded.uid, role, student: { id: studentSnap.id, ...studentSnap.data() } });
    }

    return NextResponse.json({ uid: decoded.uid, role, profile: userProfile });
  } catch {
    return NextResponse.json({ error: "Firebase login verify nahi ho paya. Dobara login karo." }, { status: 401 });
  }
}
