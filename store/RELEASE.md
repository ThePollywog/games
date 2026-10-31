# App Store release sheet

Everything to type into App Store Connect for the four apps, and the steps left. How the apps are built, the leaderboard settings and the review risks are in [IOS.md](../IOS.md); each app's long-form listing text is in `store/<id>.md`.

## Before anything else: placeholders

| Placeholder | Where | Replace with |
| --- | --- | --- |
| `SUPPORT_EMAIL` (2×) | `store/site/index.html` (Support section) and `store/privacy/index.html` (Changes and questions) | The Pollywog's support address. Then push to `main`; the Pages workflow republishes both pages. |

App Store Connect will also ask for things only you can give: App Review contact (name, phone, email), and the developer name buyers see, which comes from your Apple Developer account.

## Shared answers (all four apps)

| Field | Answer |
| --- | --- |
| Support URL | https://thepollywog.github.io/games/support/ |
| Privacy Policy URL | https://thepollywog.github.io/games/privacy/ |
| Marketing URL (optional) | https://thepollywog.github.io/games/ |
| Version | 1.0.0, build 1 (set in `scripts/ios-setup.rb`) |
| Primary language | English (U.S.) |
| Category | Games › Puzzle; secondary Games › Casual |
| Price | Free; no in-app purchases |
| Copyright | 2026 The Pollywog |
| Content rights | Contains no third-party content (the fonts are open-licensed and bundled) |
| Export compliance | Answered by the build: `ITSAppUsesNonExemptEncryption = NO` |
| Game Center | On for the app and for each version; attach the app's leaderboards (below) |
| Sign-in for review | Not required: no accounts |

### App Privacy

**Data Not Collected.** Answer "No, we do not collect data from this app". The apps have no server, analytics, ads or accounts, and progress stays on the device. Game Center scores and nicknames go to Apple under Apple's own policy, and Apple doesn't count that as collection by the app. Tracking: **No**. This matches each app's `PrivacyInfo.xcprivacy` (no tracking, no collected data types, no required-reason APIs: progress lives in the web view's local storage, and nothing in the app or its Capacitor plugins uses UserDefaults or the other listed APIs).

### Age rating questionnaire (result: 4+)

- Every content description (cartoon or fantasy violence, realistic violence, sexual content or nudity, profanity or crude humor, horror or fear themes, alcohol, tobacco or drugs, mature or suggestive themes, simulated gambling, medical information): **None**.
- Unrestricted web access: **No**. The only links (Support and Privacy under the Pollywog mark) open this site in Safari.
- User-generated content, messaging or chat: **No**. Leaderboard names are Game Center nicknames, which Apple moderates.
- Contests, real gambling, advertising: **No**.
- Parental controls and age assurance: **No**; not needed, as nothing is collected.

## Per app

| | Shipshape | Buoy Oh Buoy | Knots & Bolts | Hex Marks the Spot |
| --- | --- | --- | --- | --- |
| Bundle ID | `com.thepollywog.shipshape` | `com.thepollywog.buoyohbuoy` | `com.thepollywog.knotsandbolts` | `com.thepollywog.hexmarksthespot` |
| SKU (your choice) | `pollywog-shipshape` | `pollywog-buoy-oh-buoy` | `pollywog-knots-and-bolts` | `pollywog-hex-marks-the-spot` |
| Name (30) | Shipshape: Bottle Sort | Buoy Oh Buoy: Ball Sort | Knots & Bolts: Rope Sort | Hex Marks the Spot |
| Home-screen label | Shipshape | Buoy Oh Buoy | Knots & Bolts | Hex Marks |
| Subtitle (30) | Water sort puzzle. No ads. | Ball sort puzzle. No ads. | Rope sort puzzle. No ads. | Hexa stack puzzle. No ads. |
| Promotional text, description, keywords | [store/shipshape.md](shipshape.md) | [store/buoy-oh-buoy.md](buoy-oh-buoy.md) | [store/knots-and-bolts.md](knots-and-bolts.md) | [store/hex-marks-the-spot.md](hex-marks-the-spot.md) |
| Screenshots (6.9", 1320×2868) | `store/screenshots/shipshape/` | `store/screenshots/buoy-oh-buoy/` | `store/screenshots/knots-and-bolts/` | `store/screenshots/hex-marks-the-spot/` |
| Leaderboards | `pollywog.shipshape.daily`, `.blitz`, `.campaign`, `.xp` | `pollywog.buoy_oh_buoy.daily`, `.blitz`, `.campaign`, `.xp` | `pollywog.knots_and_bolts.daily`, `.blitz`, `.campaign`, `.xp` | `pollywog.hex_marks_the_spot.daily`, `.weekly`, `.xp` |

Every listing was checked against Apple's limits (name and subtitle 30, promotional text 170, keywords 100 with no spaces, description 4000); all fit. Leaderboard types, score format and start times are in [IOS.md › Game Center leaderboards](../IOS.md#game-center-leaderboards).

Screenshots, in upload order: `1-home.png`, `2-play.png`, `3-daily.png`. Upload them to the 6.9" iPhone slot; App Store Connect scales them for smaller iPhones.

## Steps left, in order

1. **Fill in the support email** (table above) and push.
2. **Register the bundle IDs.** developer.apple.com › Certificates, IDs & Profiles › Identifiers: add the four bundle IDs above as App IDs, each with the **Game Center** capability.
3. **Create the four apps** in App Store Connect › Apps › New App: iOS, the name, English (U.S.), the bundle ID and SKU from the table.
4. **Create the leaderboards** for each app (15 in all), exactly as in IOS.md.
5. **Set signing in Xcode.** `npm run ios -- build`, then for each app open `ios/<id>/App/App.xcodeproj`, select the App target › Signing & Capabilities, tick *Automatically manage signing* and choose The Pollywog's team. Check the team before archiving: IOS.md explains why.
6. **Archive and upload.** In Xcode, set the destination to *Any iOS Device (arm64)*, then Product › Archive › Distribute App › App Store Connect › Upload. Repeat for each app. Raise the build number before any re-upload.
7. **Test in TestFlight** with a Game Center sandbox account: leaderboards load, scores post, and the Support and Privacy links open Safari.
8. **Complete each version page:** paste the listing, upload the screenshots, answer App Privacy and the age rating as above, turn on Game Center and attach the leaderboards, pick the build, and set pricing and availability.
9. **Submit for review.** Send one sort game and Hex Marks the Spot first; IOS.md › Review risks explains why the three sort games shouldn't all go at once.
