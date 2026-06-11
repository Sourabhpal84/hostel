# Premium PG & Hostel Management Web Application

This project is a production-ready starter for a premium PG/hostel business website with public pages, admin dashboard, student dashboard, Firebase integration points, Firestore rules, Storage rules, PWA support, and a Razorpay order API route.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For Vercel deployment, see `DEPLOYMENT.md`.

## Login Flow

When Firebase env keys are configured, login uses Firebase Authentication email/password.

- Public visitor: homepage, rooms, food timetable, notices, contact, Magneetoz promo.
- Admin: dashboard stats, new admission, fee update, notice management, complaint resolution, room management.
- Student: profile, fee summary, notices, complaint submission, food timetable.
- Magneetoz: separate offer manager for restaurant banner, coupon, title, description, image, and enable/disable.
- Central Magneetoz: one reusable promotion model for banner, food images, coupon, referral code, links, QR codes, videos, connected PG sources, and analytics.

Create these users in Firebase Authentication:

- Admin user: set email in `NEXT_PUBLIC_ADMIN_EMAIL`
- Magneetoz user: `magneetoz73@gmail.com`
- Student users: create email/password and add the same email in the student admission record

## Firebase Setup

Create `.env.local` from `.env.example` and add your Firebase config:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_ADMIN_EMAIL=
NEXT_PUBLIC_MAGNEETOZ_EMAIL=magneetoz73@gmail.com
NEXT_PUBLIC_PG_SOURCE_ID=APBOYS
```

## Centralized Magneetoz System

All PG websites should use the same central Firestore records:

- `centralMagneetoz/settings`: central promotion content
- `centralMagneetozSites`: connected PG websites with unique `sourceId`
- `centralMagneetozEvents`: click/order tracking events

For every future PG website, only set one unique env value:

```bash
NEXT_PUBLIC_PG_SOURCE_ID=UNIQUE_PG_CODE
```

The promotion link automatically appends `source` and `ref` query parameters so Magneetoz can identify which PG generated the click/order.

For the exact future-PG rollout process, see `MULTI_PG_PLAYBOOK.md`.

Suggested Firestore collections:

- `users`: `{ uid, role: "admin" | "student", email, studentId? }`
- `students`: admission, room, bed, fee, due date, payment history
- `rooms`: room number, total beds, occupied beds, photos, video URL
- `notices`: title, description, priority, date
- `complaints`: student details, category, description, status, remarks
- `settings/site`: PG name, logo, hero, contact, map, facilities, Magneetoz banner
- `payments`: Razorpay/cash/UPI payment records

Deploy `firestore.rules` and `storage.rules` in Firebase Console or Firebase CLI.

## Razorpay Flow

The API route is available at:

`POST /api/razorpay/order`

Body:

```json
{
  "amount": 9500,
  "receipt": "REC-IPG-1001"
}
```

After payment success, save a payment record in Firestore and update the student's `paidAmount` and `paymentHistory`.

## Next Work

For a fully live production release, connect the dashboard forms to Firebase Authentication and Firestore writes:

- Admin creates Firebase Auth user for student.
- Admin stores student profile in `students/{uid}`.
- Student dashboard listens to `students/{uid}`, `notices`, `settings/site`, `complaints`.
- Admin dashboard listens to all collections in real time.
- Razorpay success updates payment history and fee balance.
