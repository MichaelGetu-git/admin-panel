# Store Locator Admin Panel Launch Pack

Use this launch pack to prepare the admin panel and the matching React Native
app for production operations.

## Project Summary

| Item | Value |
| --- | --- |
| Admin panel | Store Locator Admin Panel |
| Slug | `store-locator-admin-panel` |
| Mobile app source | `storeLocator` |
| Theme preset | `listings` |

## Launch Sequence

1. Create or choose the Firebase project used by the mobile app.
2. Enable Firebase Auth, Firestore, and Storage.
3. Configure `.env.local` with Firebase web config and server credentials.
4. Create the first owner admin account.
5. Run the admin panel locally and complete Launch Checklist.
6. Add starter data and upload launch media.
7. Test the matching React Native app against the same Firebase data.
8. Build the admin panel and deploy it with server-side secrets.

## Environment Checklist

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public Firebase web config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public Firebase web config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public Firebase web config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public Firebase web config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public Firebase web config |
| `FIREBASE_PROJECT_ID` | Server-side Firebase Admin SDK config |
| `FIREBASE_CLIENT_EMAIL` | Server-side Firebase Admin SDK config |
| `FIREBASE_PRIVATE_KEY` | Server-side Firebase Admin SDK config |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Server-side Firebase Admin SDK config |
| `FIREBASE_STORAGE_BUCKET` | Server-side Firebase Admin SDK config |

Provider keys depend on the app and enabled features. Add only the providers
you use in production.

| Variable | Purpose |
| --- | --- |
| `SENDGRID_API_KEY` | Email campaigns |
| `FIREBASE_PROJECT_ID` | Server-side Firebase Admin SDK config |
| `UPLOAD_MAX_FILE_SIZE_MB` | Media upload limits |
| `GOOGLE_MAPS_API_KEY` | Maps and location workflows |

## Roles

| Role | Use it for |
| --- | --- |
| `owner` | Setup, secrets, team access, production settings |
| `operator` | Orders, bookings, trips, listings, and day-to-day operations |
| `support` | User lookup, support notes, account assistance |
| `moderator` | Reports, user-generated content, dating safety, social moderation |
| `content_manager` | Catalog, listings, media, templates, and campaigns |

## Starter Data

Create enough data for a real first app session:

- Owner admin account
- Support test user
- Email template for a launch announcement
- Starter chats
- Starter categories
- Starter filters
- Starter listings
- Starter reviews
- Starter saved listings
- Launch media assets in Media Library
- Records with valid coordinates for map screens

## Operational Pages

Shared pages:

- Dashboard
- Launch Checklist
- App Settings
- Admin Roles
- Audit Log
- Support Cockpit
- Campaigns
- Media Library

App-specific pages:

- Listings Operations (/admin/listings-operations)
- Messaging Operations (/admin/messaging)

## Main Workflows

- Complete Launch Checklist
- Update App Settings
- Invite team members in Admin Roles
- Review Audit Log after critical actions
- Search and support users in Support Cockpit
- Export CSV for operational review
- Upload and reuse media assets
- Prepare email campaign segments
- Prepare push campaign segments
- Run Listings Operations
- Run Messaging Operations

## Done Criteria

The admin panel is ready for production operations when:

- owner login works;
- roles are assigned;
- Firebase data is shared with the mobile app;
- media upload works;
- CSV export works for at least one entity;
- a safe create, update, and delete flow works;
- app-specific workflow pages load;
- the matching React Native app reflects admin changes.
