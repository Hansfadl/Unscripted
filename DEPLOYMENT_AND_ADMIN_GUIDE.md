# UNSCRIPTED — Admin Provisioning & Production Deployment Guide

## 1. Current AI Studio Environment Status
- **Firebase Project ID**: `maximal-lodge-mfx4d`
- **Firestore Database ID**: `ai-studio-2c69ca0c-38a9-42ee-87d4-153b1cfa3cdb`
- **Authentication**: Google Sign-In enabled; backend-authorized admins are `syehansf@gmail.com` and `unscriptedwcc29@gmail.com`.
- **Deployed Security Rules**: `firestore.rules` is deployed and enforced via Firestore Security Rules (`NEW_INQUIRY` / `UNPAID` enforcement, `request.time` timestamp enforcement, strict key/type/size checks, zero public reads on `bookings`, `customers`, `invoices`, `invoice_counters`, and `invoice_settings`).

## 2. Administrator Access
1. Navigate to `/admin/login`.
2. Click **Continue with Google** and sign in with either `syehansf@gmail.com` or `unscriptedwcc29@gmail.com`.
3. On sign-in, Firebase Authentication verifies the user's UID and verified email via ID token claims, and Firestore Security Rules enforce backend admin authorization across `/users/{uid}`, bookings, invoice management, portfolio, packages, customers, couple notes, homepage customization, and settings.
4. Any other Google account attempting to sign in at `/admin/login` is denied admin access unless explicitly granted admin privileges (`admin: true` custom claim or admin-provisioned `/users/{uid}` record).

## 3. Deploying to Firebase Hosting (`unscripted.id`)
1. Install Firebase CLI locally:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Build the production bundle:
   ```bash
   npm run build
   ```
3. Deploy Hosting, Firestore Rules, and Storage Rules:
   ```bash
   firebase deploy --only hosting,firestore:rules,storage
   ```
4. **Custom Domain (`unscripted.id`)**:
   - Open Firebase Console -> Hosting -> **Add custom domain** -> enter `unscripted.id`.
   - Add the TXT ownership verification record and A/AAAA DNS records provided by Firebase at your DNS registrar.
   - Wait for SSL/TLS certificate provisioning (automatic HTTPS).

## 4. Optional Production Upgrades (User-Owned Blaze Project)
AI Studio Starter Tier projects do not include IAM for Cloud Functions or Firebase Storage provisioning out of the box. When migrating to a user-owned Firebase Blaze project:
- **Firebase Storage**: Enable Storage in Firebase Console and deploy `storage.rules` for direct photo/video uploads in `/admin/portfolio`.
- **Cloud Functions (2nd Gen) & App Check**: Enable App Check (reCAPTCHA v3 / Enterprise) and move public booking creation + rate limiting behind an HTTPS Callable Cloud Function if desired.

## 5. Rollback
- In Firebase Console -> Hosting -> Release history, select any previous release and click **Rollback** for instant static asset rollback.
