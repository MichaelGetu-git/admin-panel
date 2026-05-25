# Store Locator Admin Panel Operations Checklist

Use this checklist before giving day-to-day access to the team that will run
the admin panel in production.

## Access

- Production admin panel URL
- Owner admin account
- Backup owner admin account
- Firebase project access
- Hosting provider access
- Provider dashboards for email, push, maps, payments, OpenAI, Twilio, or other
  enabled integrations

## Configuration

- Brand name
- Support email
- Support phone
- Support URL
- Privacy policy URL
- Terms URL
- Minimum app version
- Feature flags
- Production Firebase project ID

## Secrets

Do not share secrets in Git, screenshots, chat, or public docs. Give the
operations owner access to the secret manager or hosting provider dashboard
instead.

Server-only values to verify:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `SENDGRID_API_KEY`
- `STRIPE_SECRET_KEY`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

## Team Roles

Record who owns each responsibility:

| Responsibility | Owner |
| --- | --- |
| Business operations |  |
| Technical operations |  |
| Support |  |
| Content |  |
| Moderation |  |
| Payments or fulfillment |  |

## Data Readiness

- Starter content created
- Media assets uploaded
- Test users documented
- CSV export tested
- App-specific operational records reviewed
- Known follow-up items listed

## Production Routine

- Review Audit Log daily during the first production week.
- Watch Firebase usage and costs.
- Check failed uploads and provider errors.
- Review support notes.
- Remove temporary setup accounts when configuration is complete.
- Keep at least two owner accounts active.

## Public Docs

- Admin Panels: https://instamobile.io/docs/admin-panels
- Firebase Integration: https://instamobile.io/docs/admin-panel-documentation/firebase-integration
- React Native setup: https://instamobile.io/docs/getting-started-with-react-native
