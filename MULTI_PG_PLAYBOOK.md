# Multi-PG Magneetoz Playbook

## Goal

Use the same PG website source code for many PG owners, while Magneetoz promotion content and analytics stay centralized.

## For Each New PG Website

You do not need to rebuild the promotion system.

1. Copy or clone this same source code.
2. Deploy it as a new Vercel project.
3. Add a unique PG source ID in Vercel env:

```bash
NEXT_PUBLIC_PG_SOURCE_ID=PG_OWNER_UNIQUE_CODE
```

Examples:

```bash
NEXT_PUBLIC_PG_SOURCE_ID=APBOYS
NEXT_PUBLIC_PG_SOURCE_ID=SHARMA_PG
NEXT_PUBLIC_PG_SOURCE_ID=GREEN_HOSTEL
```

4. Point that PG owner's custom domain to the Vercel project.
5. PG owner manages only their hostel/admin work.
6. Magneetoz content remains controlled centrally.

## Hidden Magneetoz Owner Login

Magneetoz login is not shown on the PG website menu.

Open this URL manually:

```text
https://your-pg-domain.com/?magneetoz=owner
```

That opens the central Magneetoz login panel.

## Tracking

When a user clicks the Magneetoz offer, the link automatically includes:

```text
source=PG_OWNER_UNIQUE_CODE
ref=COUPONPREFIX-PG_OWNER_UNIQUE_CODE
```

This lets you know which PG generated the click/order.

## Admin Student Admission

PG admin can create student email/password from the admission form.

For this to create Firebase Auth users automatically, add these server env variables in Vercel:

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

These come from Firebase Console > Project Settings > Service Accounts > Generate new private key.

Use the same Firebase project if you want all PG websites connected to one backend. Use separate Firebase projects only if you want each PG fully isolated.
