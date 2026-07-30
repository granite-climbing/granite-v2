# Profile Editing and External Store Launch Design

## Goal

Let signed-in users edit the same profile information supplied during signup, optionally save a YouTube channel URL, and open the Granite Smart Store outside the app WebView.

## Scope

- The Store tab opens its fixed Smart Store URL outside the Granite mobile app.
- Signup collects an optional YouTube channel URL.
- The My page provides a profile-edit flow that reuses the signup form UI and validation.

## External Store Navigation

The canonical destination remains `https://m.smartstore.naver.com/granite_kr`.

The web app keeps a normal anchor fallback for browsers. When the Granite native bridge advertises `navigation.external`, the Store action prevents the default navigation and sends a version-1 `navigation.open.external.requested` web-to-native message with the fixed destination URL.

The Flutter shell validates only that fixed Smart Store URL and opens it externally. Android invokes the system chooser so the user may choose among compatible installed apps. iOS opens the user’s configured default external browser; iOS does not provide a system browser-picker API. No Smart Store app-specific deep link or app-selection UI is added.

## Profile Form

Create a shared profile-form component used in two modes:

- **signup:** empty initial values and the existing completed-signup action.
- **edit:** current user values and a new authenticated profile-update action.

Both modes expose: nickname (stored as the normalized Instagram handle), gender, height, ape index, weight, bouldering grade, sport grade, and an optional YouTube channel URL. The edit form excludes email and OAuth identity because they are read-only account data.

The YouTube field accepts an empty value or an HTTPS URL hosted by `youtube.com` or `www.youtube.com`, representing a channel URL such as `https://youtube.com/@granite`. It is persisted in the existing `users.youtube_id` column, which is already nullable and surfaced by the My page. No database migration is needed.

## My Page Entry Point

The existing visible “수정” affordance beside the nickname becomes an accessible link to `/me/edit`. That page requires a valid user session, loads the active user, and renders the shared profile form with values prefilled. Successful updates redirect back to `/me`.

## Data and Validation

Centralize the shared form schema and normalization so signup and edit cannot diverge. Preserve existing numeric ranges, grade limits, and Instagram handle normalization. The authenticated update query writes only editable profile columns, checks that the user remains active, and updates `updated_at`.

## Verification

- Unit tests for URL validation and shared profile parsing.
- Action tests for signup persistence and authenticated profile updates.
- Server-rendered form tests for signup defaults and edit prefill.
- Bottom-nav web test for browser fallback and bridge dispatch.
- Flutter handler tests for the fixed Smart Store URL, iOS external-browser launch, and Android chooser behavior.
- Manual smoke test on iOS simulator and Android emulator.

## Out of Scope

- Store app deep links, Smart Store-specific app detection, and a custom chooser.
- Editing email, OAuth providers, or privacy settings through the profile form.
- Reworking the existing YouTube video-link processing used for beta records.
