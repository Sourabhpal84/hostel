# Vercel Deployment

## 1. Push project to GitHub

Upload this folder to a GitHub repository.

## 2. Import in Vercel

Open Vercel, click `Add New Project`, select the GitHub repository, and keep framework as `Next.js`.

## 3. Add Environment Variables

Add these in Vercel Project Settings:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

## 4. Firebase

In Firebase Console:

- Enable Email/Password Authentication.
- Create Firestore Database.
- Create Firebase Storage.
- Publish `firestore.rules`.
- Publish `storage.rules`.

## 5. Razorpay

In Razorpay Dashboard:

- Copy Key ID into `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- Copy Key Secret into `RAZORPAY_KEY_SECRET`.

## Real Login Setup

In Firebase Console, enable `Authentication > Sign-in method > Email/Password`.

Create Firebase Auth users:

- Admin user: same email as `NEXT_PUBLIC_ADMIN_EMAIL`
- Magneetoz user: `magneetoz73@gmail.com`
- Student users: created when you add real students

In Vercel env, set:

```bash
NEXT_PUBLIC_ADMIN_EMAIL=your-admin-email@example.com
NEXT_PUBLIC_MAGNEETOZ_EMAIL=magneetoz73@gmail.com
```

The current app is deploy-ready and works immediately with browser storage. Firebase files and rules are included so the next upgrade can replace browser storage with real shared Firestore persistence without changing the UI.
