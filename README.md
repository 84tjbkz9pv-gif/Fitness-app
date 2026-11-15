# Fitness

A personal workout log for Emily. This version records workouts on the phone. Steps, food, weight, and sleep are not in the app yet.

Workouts stay on the phone. There is no account, server, analytics, or advertising. Units are metric (minutes and kilometres).

## What you can do

- See today's date and the workouts that started today.
- Add a workout: type (run, walk, cycle, strength, swim, yoga, or other), start date and time, duration in minutes, optional distance in kilometres, and optional notes.
- Edit or delete a workout.
- Browse every logged workout, grouped by day. Today is included, under the heading Today.

Deleting the app deletes the workouts.

## Open and run on your iPhone

You need:

- A Mac with Xcode 15 or later (it includes the iOS 17 SDK)
- An iPhone on iOS 17 or later, and a USB cable
- A free Apple ID, the same one you can use on the iPhone

On the iPhone, check the version in Settings → General → About. It needs to say 17 or later.

### 1. Install Xcode

Install Xcode from the Mac App Store. Open it once and let it install the extra components. If Xcode asks you to install the iOS platform, install it.

### 2. Open the project

Copy this folder onto the Mac. In Finder, double-click `FitnessApp.xcodeproj`.

Open that project file. This app does not use CocoaPods or Swift Package Manager, so there is no workspace to open.

### 3. Sign in with your Apple ID

In Xcode, open Settings → Accounts, click the + button, and choose Apple ID. Sign in. Xcode adds a Personal Team, shown as your name followed by “Personal Team”.

### 4. Choose your iPhone

Plug the iPhone into the Mac. If the phone asks you to Trust This Computer, tap Trust and enter the phone passcode.

At the top of the Xcode window, set the scheme to **FitnessApp** and the destination to your iPhone (it appears under iOS devices, not simulators).

### 5. Set the signing team

In the left-hand navigator, click the blue FitnessApp project icon. Select the **FitnessApp** target (not FitnessAppTests). Open **Signing & Capabilities**.

- Tick **Automatically manage signing**.
- In **Team**, choose your Personal Team.

If Xcode says the bundle identifier `com.emily.FitnessApp` cannot be registered, change **Bundle Identifier** to something unique, for example `com.emily.yourname.FitnessApp`. Leave the test target alone if you only run the app.

### 6. Turn on Developer Mode

This switch only appears after the phone has been connected to Xcode.

On the iPhone, open Settings → Privacy & Security → Developer Mode and turn it on. The phone restarts. When it comes back, confirm that you want Developer Mode and enter your passcode.

If you do not see Developer Mode yet, continue to the next step and try to run the app once. Then look for the switch again, or follow the alert on the phone.

### 7. Run the app

Press the Run button, or press Command–R.

The first install often stops until the phone trusts your developer certificate. On the iPhone, open Settings → General → VPN & Device Management. On some iOS versions that row is called Device Management. Under Developer App, tap your Apple ID email, then tap Trust, and confirm.

Go back to Xcode and press Run again. The app opens on the phone. Its home-screen name is **Fitness**.

A free Personal Team provisioning profile expires after 7 days. When the app then refuses to open, plug the phone in and press Run again. Xcode refreshes the profile.

You can also run it in the simulator: choose an iPhone simulator as the destination and press Run. The simulator does not need a signing team, Developer Mode, or a trust setting.

### 8. Run the tests

Choose an iPhone simulator as the destination, then Product → Test, or press Command–U.

The tests check that a duration must be greater than zero, which workouts count as today, and how history groups days. They do not need the phone.

## Health

This version does not read Apple Health and does not ask for Health permission. A later version will ask before it reads weight (synced from the eufy scale), steps, and sleep.

Apple only grants the HealthKit capability to a paid Apple Developer Program membership. A free Personal Team is enough for this version, and not enough for that later Health access.

## Layout

- `FitnessApp/` is the app. `WorkoutLogic.swift` is the validation, “today” filter, and day grouping. `Workout.swift` is the SwiftData store.
- `FitnessAppTests/` is the unit test target.
- Open `FitnessApp.xcodeproj` in Xcode. The shared scheme is FitnessApp.
