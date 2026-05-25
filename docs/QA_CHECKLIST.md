# Store Locator Admin Panel QA Checklist

Run this checklist before deployment and before giving production access to the
operations team.

## Commands

```bash
corepack yarn install --immutable
corepack yarn typecheck
corepack yarn build
corepack yarn dev
```

## Authentication

- Owner admin can sign in.
- Non-admin users cannot access protected admin pages.
- Logout clears the session.
- Production does not use local smoke bypass settings.

## Shared Admin QA

- Dashboard loads and shows entity counts.
- Launch Checklist loads and reports setup status.
- App Settings can save a harmless value.
- Admin Roles lists owner access.
- Audit Log loads.
- Support Cockpit can search for a test user.
- Campaign segments load.
- Media Library uploads a small image.
- CSV export works for at least one entity.
- A safe create, update, and delete flow works.

## App-Specific QA

- Listings Operations page loads and shows the expected overview
- Messaging Operations page loads and shows the expected overview
- Create or approve a listing, verify it appears in the mobile app
- Create a conversation from mobile and verify Messaging Operations

## Entity QA

| Entity | Route | QA focus |
| --- | --- | --- |
| Users | `/admin/users` | Create, update, delete safe test record |
| Chats | `/admin/chats` | Read-only list and detail |
| Email Templates | `/admin/templates` | Create, update, delete safe test record |
| Categories | `/admin/categories` | Create, update, delete safe test record |
| Filters | `/admin/filters` | Create, update, delete safe test record |
| Listings | `/admin/listings` | Create, update, delete safe test record |
| Reviews | `/admin/reviews` | Create, update, delete safe test record |
| Saved Listings | `/admin/saved_listings` | Create, update, delete safe test record |

## Responsive QA

Check these pages on desktop and mobile widths:

- `/admin`
- `/admin/launch-checklist`
- `/admin/settings`
- `/admin/admins`
- `/admin/support`
- `/admin/campaigns`
- `/admin/media-library`
- `/admin/listings-operations`
- `/admin/messaging`

Make sure tables scroll or wrap cleanly, form buttons remain visible, and text
does not overlap on small screens.

## Mobile App Verification

1. Run the matching React Native app.
2. Sign in as a normal user.
3. Create or update one realistic record.
4. Find that record in the admin panel.
5. Perform an admin action.
6. Confirm the mobile app reflects the changed data.
