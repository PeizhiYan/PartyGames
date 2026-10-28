# PartyGames 🎮

Games to play with friends on your phones, in one installable app. Two to start with: **Gomoku**
(five in a row, against a friend or against the computer) and **MonopolyBuddy** (the bank for a
real Monopoly board, so nobody has to count paper money).

A React + TypeScript Progressive Web App, built for phones first and fine on a tablet or desktop,
hosted on Firebase's free Spark plan, with a **cloud-agnostic** backend layer.

## Quick start (no cloud needed)

```bash
npm install
npm run dev:memory     # in-browser "memory" backend; click "Sign in" to play as the admin
```

Open a **second browser window** on the same URL and it signs in as a different player, so the
whole multiplayer flow — open a room, ask to join, get let in, play — works with no Firebase
project at all.

## How a game works

Every game lives in a **room**:

1. Somebody opens a room and gets a four-character code (`K7PQ`).
2. Friends find the room in the list, or type the code, and **ask to join**.
3. The owner lets them in. (Nobody gets in without that.)
4. Each device in the room checks in every 25 seconds. A room with no sign of life for **15
   minutes** — no check-in, no move, nothing — is abandoned, and the next client to look at the
   list deletes it. A room never outlives the people in it, and no server-side scheduler is needed.
   (A player is shown as away after 90 seconds, but that only changes the "2 online" label. The
   deletion window has to be much longer: a locked phone stops running timers entirely, so a host
   who switches to Messages to send the code stops checking in straight away.)
5. If the owner leaves, the longest-standing remaining player becomes the owner. The last player
   out closes the room.

Gomoku can also be played **alone against the computer**, with no room — pick Easy, Normal or Hard
on the game's own screen.

## Features

- Each game has its own drawn cover art (`src/components/art/GameArt.tsx`), shown on the home
  screen and again as the banner on that game's lobby — inline SVG, so it scales to any card size
  without a second request.
- **Gomoku** – a 15×15 board on a canvas that scales to the screen. Tap an intersection to play
  there; with a mouse, a ghost stone follows the pointer. Against another player the stone sits on
  your own board for **three seconds** before it is sent, ringed and with a draining bar, so a
  mis-tap can be taken back before anyone else sees it. The last stone is marked, the winning five
  is struck through, colours swap each rematch, and the room keeps the score. Against the computer
  there's also **Insight**: the board shaded by what each point is worth.
- **MonopolyBuddy** – the host sets the starting balance and whether balances are public. Everyone
  picks a token and a colour, rolls for turn order, then sends money, pays the bank, or asks the
  bank for money (which **every other player** has to approve). Ending the game needs everyone's
  agreement; then each player types in what their property is worth and the app ranks everyone by
  cash plus property, with a chart of how the money moved.
- **Sign-in with Google.** Registration can be open to anyone or closed to an invite list.
- **Users** (admin only) – open or close registration, invite people by email, and remove an
  account, which locks them out and deletes their rooms.
- **Installable and playable offline**: standalone display, its own icon, no browser chrome, no
  pinch-zoom or pull-to-refresh, no edge-swipe navigation in the installed app. The whole app
  shell is precached, so **Gomoku against the computer works with no connection at all** — the
  board and the AI are local TypeScript and never touch the backend. Rooms need the server (every
  move is a transaction), so the app says so and stops offering what cannot work. The home page and Settings offer
  an **Install** button where the browser supports one, and the Share → Add to Home Screen steps on
  iOS Safari, which has no install dialog of its own (`src/hooks/useInstall.ts`).
- **Themes** – six highlight colours (Sunset, Rose, Violet, Ocean, Forest, Graphite) and
  light / dark / follow-the-system, picked in Settings and remembered per device. The default is a
  white background with an orange highlight. The page is tinted with the chosen colour and a band
  of slow waves drifts along the bottom of every screen, so picking a colour changes the whole app
  rather than just its buttons.

## Cloud-agnostic by design

The app talks to one small set of interfaces (`src/services/types.ts`) — `AuthService`, `RoomRepo`,
`AdminRepo`, `AccountRepo` — and never imports a cloud SDK outside `src/adapters/`. All the game
logic lives in `src/domain/` as pure functions that take state and an action and return new state.

A backend only has to do four things: sign people in, store a room document, notify watchers when it
changes, and **apply one action at a time without losing a simultaneous one**. The Firebase adapter
does that last part with a Firestore transaction: read the room, run the game's reducer, write the
result.

To move to another provider (Supabase, a self-hosted Node + Postgres + WebSocket server, PocketBase…):

1. Write `src/adapters/<name>/index.ts` returning a `Backend`.
2. Add one `case` to `createBackend()` in `src/services/index.ts`.
3. Set `VITE_BACKEND=<name>`.

Nothing in `src/pages`, `src/components`, `src/hooks` or `src/domain` changes. `src/adapters/memory`
is a complete worked example in ~300 lines, and `src/adapters/memory/rooms.test.ts` is a test suite
any new adapter can be pointed at.

## Project structure

```
src/
├─ domain/        Pure TypeScript: the games and the room rules. No React, no backend.
│  ├─ types.ts      AppUser, Room, GameDefinition — the vocabulary everything else uses.
│  ├─ rooms.ts      Join codes, who-may-do-what, when a room counts as abandoned.
│  ├─ games.ts      The registry of games.
│  ├─ gomoku/       board.ts (geometry, win detection), ai.ts (the computer), game.ts (the reducer).
│  └─ monopoly/     game.ts — the whole banking state machine as one reducer.
├─ services/      The backend wrapper: interfaces (types.ts) + the switch that picks an adapter.
├─ adapters/
│  ├─ firebase/   Firebase Auth + Firestore. The ONLY place allowed to import `firebase`.
│  └─ memory/     In-browser backend (localStorage + BroadcastChannel), for dev and demos.
├─ hooks/         React hooks: auth, live rooms, presence heartbeat, sending a game action.
├─ components/    Layout, UI primitives, and one folder per game's screens.
├─ pages/         One file per screen.
├─ lib/           Display formatting, app version.
└─ styles/        Global CSS + theme variables (light/dark).
tests/            Firestore security-rules tests (run in the emulator).
```

Dependency direction: `pages → components/hooks → services → adapters`. `domain` can be used by
anything and depends on nothing.

### Adding a game

1. `src/domain/<game>/game.ts` — export a `GameDefinition<State, Action>`: `newState`, `reduce`
   (pure, throws `GameRuleError` for an illegal move) and optionally `onPlayersChanged`.
2. Add it to `GAMES` in `src/domain/games.ts`.
3. `src/components/<game>/<Game>Room.tsx` — the screen, taking `{ room, uid }`.
4. Add it to the `Game` pick in `src/pages/RoomPage.tsx`, and to the `d.game in [...]` list in
   `firestore.rules`.

The room layer, the join flow, presence and cleanup all come for free.

## Firebase setup

PartyGames shares one Firebase project with CoffeeGlass (and any other app in it). All its data
lives under **`/apps/partygames/`** in Firestore (`ROOT` in `src/adapters/firebase/app.ts`), and
sign-in is shared — a person has the same uid in every app in the project.

1. **Firebase console → Project settings → Your apps → Add app → Web.** Call it `PartyGames`.
   Copy the config into `.env` (start from `.env.example`).
2. **Hosting**: add a second site to the project, then point this repo's hosting target at it:
   ```bash
   firebase target:apply hosting partygames <your-site-id>
   ```
3. **Let Google sign-in accept this domain.** Two different lists have to know about it, and
   missing either one breaks sign-in:
   - *Firebase console* → **Authentication → Sign-in method → Google**: enable it (already on if
     another app in the project uses it). Then **Settings → Authorized domains** → add
     `<site-id>.web.app`. Missing this gives `auth/unauthorized-domain`.
   - *Google Cloud console* → **APIs & Services → Credentials** → the OAuth 2.0 client called
     **Web client (auto created by Google Service)** → add
     `https://<site-id>.web.app/__/auth/handler` to **Authorized redirect URIs** and
     `https://<site-id>.web.app` to **Authorized JavaScript origins**. Missing this gives
     **`Error 400: redirect_uri_mismatch`**.

   Firebase only registers the project's *default* domain (`<project-id>.firebaseapp.com`)
   automatically. Every extra Hosting site and every custom domain has to be added by hand, in
   both places.
4. Set `VITE_FIREBASE_AUTH_DOMAIN` to **the domain the app is served from** — `<site-id>.web.app`,
   or the custom domain once there is one — and *not* `<project-id>.firebaseapp.com`. Google
   sign-in then happens on the same origin as the app, which is what makes it work inside the
   installed PWA on iOS. Firebase Hosting serves the sign-in handler under `/__/auth/` on every
   domain attached to the site, and the service worker is told to leave `/__/` alone
   (`navigateFallbackDenylist` in `vite.config.ts`).
5. **Deploy:**
   ```bash
   npm run deploy      # build + firebase deploy --only hosting:partygames,firestore
   ```

### Adding a custom domain

The live app is at **https://play.auroratns.com** (Hosting site `party-games-38541`, DNS on
Cloudflare). To attach a domain to the site:

1. **Hosting → the site → Add custom domain**, and add the TXT and A records Firebase gives you at
   the DNS provider.
2. On Cloudflare, set those records to **DNS only** (grey cloud, not orange). Proxying them blocks
   Firebase's certificate challenge, and the domain sits on "Needs setup" forever.
3. Wait for the certificate — minutes to a day. `curl -I https://<domain>` tells you when it's live.
4. **Authorize the domain for sign-in, in both places** (see step 3 of the setup above):
   Firebase **Authentication → Settings → Authorized domains**, *and* the Google Cloud OAuth
   client's **Authorized redirect URIs** (`https://play.auroratns.com/__/auth/handler`) and
   **Authorized JavaScript origins** (`https://play.auroratns.com`).
5. Only now point `VITE_FIREBASE_AUTH_DOMAIN` at it, rebuild and redeploy. Doing this before steps
   3 and 4 breaks sign-in for everyone, including on the old domain.

### ⚠️ This repo owns the Firestore rules for the whole project

`firestore.rules` is deployed for the **entire database**, not just this app, so deploying it sets
CoffeeGlass's rules too. Rather than have both repos race to overwrite each other, **only this one
deploys rules.** Every other app in the project deploys `--only hosting`.

So this file carries a `match /apps/<appId>` block for *every* app in `vibed-apps`, and adding an
app means adding its block here. See "Owning the rules" below.

### What the rules do and don't do

They decide **who may read and write what**: only people allowed in can see rooms, only players in
a room can change its game state, somebody outside can only add their own join request, and only
the owner can let people in.

They do **not** decide whether a move is legal — that is `src/domain`, running inside the
transaction. And a room can be deleted by anyone allowed, because cleanup runs in the client and
rules cannot tell "everybody left" from "I want this gone". In a group of friends on an invite list
that is the right trade; if this ever opens up to strangers, move cleanup to a scheduled Cloud
Function and tighten `allow delete`.

Dice are rolled on the player's device and checked by the reducer for being two numbers from 1 to 6.
Nothing of value rides on a roll the app can't verify.

## Automatic deploys (GitHub Actions)

`.github/workflows/deploy_to_firebase.yml` runs on every push to `main`, including merged pull
requests. It runs lint, typecheck, the unit tests and the rules tests, checks the rules file still
covers every app in the project, builds, then deploys hosting and Firestore rules. If any check
fails, nothing is deployed. You can also start it by hand from the **Actions** tab
(**Deploy to Firebase → Run workflow**).

One-time setup:

1. **Service account.** Google Cloud Console → **IAM & Admin → Service accounts → Create service
   account** (e.g. `github-deploy`). Give it **Firebase Admin** and **Service Usage Consumer**.
   Open it → **Keys → Add key → Create new key → JSON**. If CoffeeGlass already has one, reuse it.
2. **GitHub → the repo → Settings → Secrets and variables → Actions**:
   - **Secrets** → `FIREBASE_SERVICE_ACCOUNT`, value = the whole JSON key file. Then delete the
     downloaded file.
   - **Variables** → one per line of your `.env`: `VITE_ADMIN_EMAIL`, `VITE_FIREBASE_API_KEY`,
     `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
     `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. These ship in the bundle and are
     public, so they are variables, not secrets.

When you change `.env`, change the matching variable too — the deployed app is built from the
variables, not from your `.env`.

### Owning the rules

The apps have no backend — browsers talk to Firestore directly — so `firestore.rules` is the only
thing deciding who may read and write what. It covers the **whole database**, and deploying it
replaces every app's rules in one go.

That makes "which repo deploys it" the thing to get right. **PartyGames does; nobody else.**

| Repo | Deploys |
|---|---|
| **PartyGames** (this one) | `--only hosting:partygames,firestore` |
| CoffeeGlass | `--only hosting` |

It used to be that both deployed rules, and each repo's copy only knew about its own app. That is a
quiet way to lose everything: a push to CoffeeGlass would replace the live rules with a file that
had never heard of `/apps/partygames`, every read and write here would start failing with
permission-denied, and nothing in this repo would have changed to explain it. One owner removes
the race entirely.

CoffeeGlass still keeps a copy of the file so it can run its own rules tests, but never deploys
it. If it drifts, its tests run against a stale ruleset — annoying, not dangerous. `diff` the two
after a change if you want them in step.

**Adding a third app to the project:**

1. Add its `match /apps/<appId>` block to `firestore.rules` **here**, and its id to the check in
   `.github/workflows/deploy_to_firebase.yml`.
2. Deploy from here. Its rules are live before the app ships.
3. Give the new app `--only hosting` in its own deploy script and workflow. It never touches this
   file.

The workflow refuses to deploy a rules file that has lost an app's block, so the one failure that
would silently lock an app out of its own data stops the build instead.

## Being the admin

`VITE_ADMIN_EMAIL` controls what the UI offers; the real check is the hard-coded email in
`firestore.rules`. Change both if the admin changes.

The **Users** page lets you:

- **Open or close registration.** Closed means only the invite list (and you) can play.
- **Invite** someone by email, before or after they first try to sign in.
- **Remove an account**: deletes their invite, deletes their rooms, and marks their member record
  `disabled`, which locks them out even while registration is open.

Removing an account does not delete their **Firebase Auth** identity — that lives with the identity
provider and needs admin credentials. To delete that too:

```bash
firebase auth:export users.json --project <project-id>   # find their uid
# then, with the Admin SDK or the console: Authentication > Users > Delete account
```

Their `disabled` member record is what keeps them out in the meantime, so this step is optional.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server against Firebase (needs `.env`) |
| `npm run dev:memory` | Dev server with the in-browser backend — no cloud |
| `npm run emulators` | Local Firebase Auth + Firestore emulators |
| `npm test` | Unit tests (games, AI, rooms, memory adapter) |
| `npm run test:rules` | Security-rules tests against the Firestore emulator (needs Java) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run icons` | Regenerate every PWA icon size from `public/icon.svg` |
| `npm run build` / `npm run deploy` | Production build / build and deploy |

## Credits

- **Gomoku** is ported from the original JavaScript version in
  [`PeizhiYan.github.io/js_codes/gomoku`](../PeizhiYan.github.io/js_codes/gomoku) — the pattern
  weights, the offence + defence + centre-bias move scoring, the alpha-beta search at even depths
  and the Insight heat map are all from there. See the comment at the top of
  `src/domain/gomoku/ai.ts` for how the original's 2D convolution filters map onto this version's
  line scanning.
- **MonopolyBuddy** is ported from [`../MonopolyBuddy`](../MonopolyBuddy), whose phase machine,
  all-others-must-approve bank requests and unanimous end-game vote are kept as they were. Players
  are now identified by their signed-in account instead of a passphrase and a session token, so a
  refresh (or a different phone) picks up where they left off.
