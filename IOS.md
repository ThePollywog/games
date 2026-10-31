# iOS App Store release

**The Pollywog** publishes four nautical puzzle games as separate App Store apps, all built from this codebase with [Capacitor](https://capacitorjs.com). The iOS apps have no server. Progress stays on the device and leaderboards run on **Game Center**. The web build is the combined Pollywog Arcade; it uses this repo's leaderboard server, or none on GitHub Pages (see the README).

| App | Home-screen label | Game id (folders) | Bundle id |
| --- | --- | --- | --- |
| Shipshape: Bottle Sort | Shipshape | `shipshape` | `com.thepollywog.shipshape` |
| Buoy Oh Buoy: Ball Sort | Buoy Oh Buoy | `buoy-oh-buoy` | `com.thepollywog.buoyohbuoy` |
| Knots & Bolts: Rope Sort | Knots & Bolts | `knots-and-bolts` | `com.thepollywog.knotsandbolts` |
| Hex Marks the Spot | Hex Marks | `hex-marks-the-spot` | `com.thepollywog.hexmarksthespot` |

Each app's files are in `ios/<id>/` (Xcode project), `resources/<id>/` (icon art), `store/<id>.md` (listing) and `store/screenshots/<id>/`. **[store/RELEASE.md](store/RELEASE.md)** is the sheet of App Store Connect answers and the ordered steps to release.

## Status

**Done in the repo.** All four apps:

- build for device in Release, iPhone only, portrait, version 1.0.0 (build 1)
- have an icon, splash screen, privacy manifest and export-compliance flag
- have a listing: name, subtitle, promo text, description, keywords, category, age rating
- use the Pollywog mission-plate look: paper, grid, ink and small orange marks, with patch icons and the mission patch as the splash
- have three 6.9" screenshots (1320×2868): home, a game in progress, the daily challenge
- have a support page (`store/site/`, published at `/support/`) and a privacy policy (`store/privacy/`, published at `/privacy/`) on the GitHub Pages site, linked from each app's home screen

**Still to do:**

1. **Fill in the support email.** Replace the `SUPPORT_EMAIL` placeholders in `store/site/index.html` and `store/privacy/index.html`, then push to `main`. The Support URL is https://thepollywog.github.io/games/support/ and the Privacy Policy URL is https://thepollywog.github.io/games/privacy/.
2. **Register the apps.** In your Apple Developer account, register the four bundle ids with the Game Center capability, then create the four apps in App Store Connect. The developer name buyers see comes from the account; set it to The Pollywog if you want that.
3. **Set signing.** Open each project (`npm run ios -- open <id>`) and choose your team under Signing & Capabilities. The only signing certificate on the build Mac belonged to a different Apple account, so make sure you pick the right team.
4. **Create the leaderboards** listed below, and enable Game Center on each app version.
5. **Fill in each listing.** Copy the fields from `store/<id>.md`, upload the screenshots, and answer App Privacy and the age rating as in [store/RELEASE.md](store/RELEASE.md).
6. **Test in TestFlight** with a Game Center sandbox account signed in.
7. **Archive and submit.** In Xcode, go to Product › Archive › Distribute App › App Store Connect. Before each new upload, raise the build number (`CURRENT_PROJECT_VERSION`).

## Commands

```bash
npm run ios -- build [id...]   # typecheck, build each app's web bundle, sync it into Xcode (default: all four)
npm run ios -- open <id>       # open the Xcode project
npm run ios -- run <id>        # build and run on a simulator or connected device
npm run ios -- add <id>        # regenerate ios/<id> (delete the folder first)
```

Each Xcode project holds its own copy of the web app (`dist-apps/<id>/`). Rerun `npm run ios -- build` after any web change.

## Game Center leaderboards

Create these for each app under App Store Connect › the app › Services › Game Center › Leaderboards. The IDs must match exactly, and once created they can't be renamed. Every board uses **Integer** scores, sorted **High to Low**, with a minimum of 0.

| App | Leaderboard ID | Type |
| --- | --- | --- |
| Shipshape | `pollywog.shipshape.daily` | Recurring, 1 day |
| | `pollywog.shipshape.blitz` | Recurring, 1 week |
| | `pollywog.shipshape.campaign` | Classic |
| | `pollywog.shipshape.xp` | Classic |
| Buoy Oh Buoy | `pollywog.buoy_oh_buoy.daily` · `.blitz` · `.campaign` · `.xp` | same as Shipshape |
| Knots & Bolts | `pollywog.knots_and_bolts.daily` · `.blitz` · `.campaign` · `.xp` | same as Shipshape |
| Hex Marks the Spot | `pollywog.hex_marks_the_spot.daily` | Recurring, 1 day |
| | `pollywog.hex_marks_the_spot.weekly` | Recurring, 1 week |
| | `pollywog.hex_marks_the_spot.xp` | Classic |

That's 15 in total. Start every recurring board at 00:00 **UTC**, because the game's days and weeks are in UTC. Start the weekly boards on a Monday.

## How it's built

**One app per game.** Building with `VITE_GAME=<id>` (see `src/games/edition.ts`) produces a single-game app. That game's home screen becomes the app's home, with the profile bar and the Ranks, Awards, Shop and Settings buttons. Links to other games go home, and achievements that need another game are hidden (the `games` field in `src/platform/achievements.ts`). Without `VITE_GAME`, you get the full arcade.

**Native projects.** `capacitor.config.ts` uses the `GAME` variable to pick each app's bundle id, name, web build and Xcode folder. Native code shared by all four apps lives once in `native/ios/`, and every project points to it, so edit it there:

- `GameCenterPlugin.swift`: sign in, submit scores, load leaderboards, and show Apple's leaderboard screen
- `MainViewController.swift`: registers the plugin
- `App.entitlements`: the Game Center entitlement
- `PrivacyInfo.xcprivacy`: no data collected, no tracking

`scripts/ios-setup.rb` configures each project after it's generated. It adds the shared files and GameKit, makes the app iPhone-only and portrait, sets the Info.plist values (display name, export compliance, status bar), and installs the icon and splash. It needs the `xcodeproj` Ruby gem, and falls back to the copy that comes with Homebrew's CocoaPods.

**Art.** `resources/<id>/icon.svg` is each app's icon picture, flat line art in the brand colors. `scripts/ios-assets.sh <id>` places it in a Pollywog patch frame (ink rings, compass ticks, orange markers, a star) on grid paper and saves a 1024px icon, plus the small copy the arcade hub shows (`public/icons/<id>.png`). It also makes the splash screen: the mission patch, `resources/brand/pollywog-badge.png`, centered on paper. It needs ImageMagick. The status bar uses dark text to suit the light background.

**Screenshots.** The ones in `store/screenshots/` were captured from the single-game web builds at 440×956 points and 3× scale, which is the same layout the apps show. Retake them the same way, or in the iPhone 17 Pro Max simulator, after any visual change.

**Game Center in the app.** `src/platform/gameCenter.ts` works the same way as the web version's leaderboard API, and `src/platform/api.ts` uses it automatically on iOS.

- **Scores:** the app works out each score by replaying the moves with the same `shared/` code the server uses. Game Center can't verify scores, so a modified copy of the app could post any score.
- **Player names:** players appear under their Game Center nickname, so the rename option is hidden.
- **Sign-in:** the app asks at launch. If the player says no, the games still work and the leaderboards ask them to sign in.
- **Detail on each entry:** stars, levels solved or tiles cleared.

## Shared settings

| | |
| --- | --- |
| Version | 1.0.0 (build 1), set in `scripts/ios-setup.rb` |
| Devices | iPhone, portrait only. iPads run the apps in iPhone compatibility mode. |
| Haptics | `@capacitor/haptics`, because iOS doesn't support the browser's `navigator.vibrate` |
| Privacy | No data collected, no tracking, no ads, no purchases |
| Export compliance | `ITSAppUsesNonExemptEncryption = NO` |

## Review risks

- **Guideline 4.3, duplicate apps (the biggest risk).** Apple can reject several apps from one developer that are built from the same template. Shipshape, Buoy Oh Buoy and Knots & Bolts share an engine and layout, so a reviewer may treat them as one app submitted three times. Hex Marks the Spot is a different game and isn't at risk here. Submit one sort game first, and make each later one clearly different in look, modes and description.
- **Guideline 4.2, minimum functionality.** Apple looks harder at apps built from web code. Game Center, haptics and offline play help. Use TestFlight to check that each app feels like a native app.
- **Names in the listings.** Keep "Free" out of names and subtitles (guideline 2.3.7); the subtitles say "No ads" instead.
- **Leaderboard names** are Game Center nicknames, which Apple moderates, so the apps don't need their own reporting or filtering.
