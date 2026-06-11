import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const firebaseAdminReady = Boolean(projectId && clientEmail && privateKey);

const adminApp = firebaseAdminReady && !getApps().length
  ? initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    })
  : getApps()[0];

export const adminAuth = firebaseAdminReady && adminApp ? getAuth(adminApp) : null;
export const adminDb = firebaseAdminReady && adminApp ? getFirestore(adminApp) : null;
