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

- Each game has its own drawn cover art (`src/games/<id>/Art.tsx`), shown on the home
  screen and again as the banner on that game's lobby — inline SVG, so it scales to any card size
  without a second request.
- **Gomoku** – a 15×15 board on a canvas that scales to the screen. Tap an intersection to play
  there; with a mouse, a ghost stone follows the pointer. Against another player a mis-tap can be
  undone by **asking for it back** — the opponent sees the request and agrees or doesn't, and
  agreeing unplays the stone (and their reply, if they have already made one). The last stone is
  marked, the winning five
  is struck through, colours swap each rematch, and the room keeps the score. Against the computer
  there's also **Insight**: the board shaded by what each point is worth.
- **Monopoly** – two ways to play, chosen by the host.
  - **Play the board** — the whole game happens here. Tokens move, rent is charged, Chance and
    Community Chest are drawn, jail works three ways in and three ways out, houses build evenly on
    a complete set, and a player who cannot pay goes bankrupt until one is left. No auctions,
    trading or mortgages.
  - **Bank only** — you have a real board on the table and the app moves money. It still knows
    which board you are on, so buying a property picks it by name at its printed price. That is
    what lets the final standings **add themselves up**; nobody types what their property is
    worth any more.
  - Four boards, and they are different shapes, not just different names: **Vancouver** and
    **New York** are the long 40-space game with eight colour groups, **Japan** is 36 spaces with
    six, and **China** is 32 — so a monopoly comes together sooner and the game runs shorter.
    Each has its own currency, prices and salary.
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

## Roadmap

### More games

| Game | Players | Notes |
|---|---|---|
| **Chinese chess** (象棋) | 2 | Closest to what exists. Same shape as Gomoku: a board, alternating turns, a reducer that validates a move. Piece movement rules are the bulk of the work. |
| **Chess** | 2 | As above, plus castling, en passant and promotion — the awkward corners are all in the rules, not the plumbing. |
| **Yahtzee** | 2–6 | Dice and a scorecard. `throwDice()` and the `Dice` component already exist; the interesting part is the scoring table and keeping it honest about which categories are still open. |
| **UNO** | 2–10 | Needs hidden hands — see below. |
| **Mahjong** (麻将) | 4 | Hidden hands too, and by far the most rules. Worth deciding up front which variant, since 国标 / 广东 / 日麻 score completely differently. |

### The thing that blocks UNO and Mahjong

Everything today is **open information**. A room is one document holding the whole game state, and
every player in the room can read all of it — which is fine for Gomoku (the board is public
anyway) and for MonopolyBuddy (balances are public, or hidden only as a courtesy).

A card game is different: if a hand lives in the room document, anyone can read the document and
see it. Hiding it in the UI changes nothing, because the data is already on their device. Making
that genuinely secret needs one of:

- **server-side filtering** — a Cloud Function or a real server that sends each player only their
  own hand, which means game logic moving off the client; or
- **per-player documents** (`rooms/{id}/hands/{uid}`) with security rules that let only that uid
  read them, and a deck the server deals from.

Either is a real change to the room layer, not just a new reducer. Worth doing once, before the
first card game rather than during it.

### Backend portability

`src/adapters/selfhost/` doesn't exist yet. The seam does — the app talks to 24 methods in
`src/services/types.ts` and nothing outside `src/adapters/firebase/` imports `firebase` — so
moving to a self-hosted Node server (or Supabase, or PocketBase) is one adapter plus one `case` in
`src/services/index.ts`. `src/adapters/memory/index.ts` is a complete worked example in ~330
lines, and `src/adapters/memory/rooms.test.ts` can be pointed at any new adapter to check it.

Because the game rules are pure functions in `src/games/*/rules.ts` — reachable through
`games/registry.ts`, which holds no React — a Node server could import the very
same reducers rather than reimplementing them. The likely middle path is self-hosting the data and
keeping Firebase Auth for identity, verifying ID tokens server-side — that avoids reimplementing
Google OAuth, which is the genuinely unpleasant part.

## Cloud-agnostic by design

The app talks to one small set of interfaces (`src/services/types.ts`) — `AuthService`, `RoomRepo`,
`AdminRepo`, `AccountRepo` — and never imports a cloud SDK outside `src/adapters/`. All the game
logic lives in `src/games/*/rules.ts` as pure functions that take state and an action and return
new state.

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
├─ types.ts        The shared vocabulary: Room, AppUser, GameDefinition, GameId.
├─ games/          One folder per game — its rules, screens, art and tests, all together.
│  ├─ registry.ts    Rules only. Pure TypeScript; this is what the backend adapters import.
│  ├─ screens.tsx    id → { Room, Solo?, Art }. React; only the UI imports this.
│  ├─ art.ts         The 640x200 canvas every cover is drawn on.
│  ├─ gomoku/        rules · board · ai (+ tests) · Room · BoardCanvas · Solo · Art
│  └─ monopoly/      rules (+ tests) · Room · Dice · BalanceChart · Art
├─ rooms/          The multiplayer layer games plug into: rules, useRooms, RoomList.
├─ services/       The backend contract: interfaces + the switch that picks an adapter.
├─ adapters/
│  ├─ firebase/    Firebase Auth + Firestore. The ONLY place allowed to import `firebase`.
│  └─ memory/      In-browser backend (localStorage + BroadcastChannel), for dev and demos.
├─ ui/             Design-system primitives: Icon, Sheet, Toast, Segmented, Avatar.
├─ shell/          App chrome: AppShell, Waves, ThemePicker, InstallCard, OfflineNotice.
├─ pages/          Screens that are not a game: Home, lobby, Rooms, Settings, Users, Login.
├─ hooks/          useAuth, useInstall, useOnline.
└─ lib/ styles/    Formatting, theme, version · global CSS and theme tokens.
tests/            Firestore security-rules tests (run in the emulator).
```

Dependency direction: `pages / shell / ui → games → rooms → services → adapters`. `types.ts`
depends on nothing and anything may use it.

**The two registries are split on purpose.** `games/registry.ts` holds rules and no React, because
the backend adapters import it to run a reducer inside a transaction — and a self-hosted Node
server would do the same. `games/screens.tsx` holds the React half. Merging them would quietly
drag the whole UI into the backend.

### Adding a game

Everything about a game lives in `src/games/<id>/`, and TypeScript names anything you forget:

1. Add the id to the `GameId` union in `src/types.ts`. Both registries are typed `Record<GameId, …>`,
   so this alone breaks the build until the game is fully wired — deliberately.
2. Create `src/games/<id>/` with `rules.ts` (a `GameDefinition`), `Room.tsx` (taking
   `{ room, uid }`), `Art.tsx`, and `Solo.tsx` if it can be played alone. Tests sit beside them.
3. Register it in `games/registry.ts` and `games/screens.tsx`.
4. Add the id to `d.game in [...]` in `firestore.rules`.

The home grid, the lobby, the room page, the solo route and the room list all read the registries,
so there are no per-game branches anywhere else. The room layer — join codes, approval, presence,
cleanup — comes for free.

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
  `src/games/gomoku/ai.ts` for how the original's 2D convolution filters map onto this version's
  line scanning.
- **MonopolyBuddy** is ported from [`../MonopolyBuddy`](../MonopolyBuddy), whose phase machine,
  all-others-must-approve bank requests and unanimous end-game vote are kept as they were. Players
  are now identified by their signed-in account instead of a passphrase and a session token, so a
  refresh (or a different phone) picks up where they left off.
