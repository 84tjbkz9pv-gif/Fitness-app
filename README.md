# Fitness

A personal workout log for Emily. It is a website she can add to the iPhone home screen. This version records workouts. Steps, food, weight, and sleep are not in it yet.

Workouts stay in the browser on that phone. There is no account, server, analytics, or advertising. Units are metric (minutes and kilometres).

## What you can do

- See today's date and the workouts that started today.
- Add a workout: type (run, walk, cycle, strength, swim, yoga, or other), start date and time, duration in minutes, optional distance in kilometres, and optional notes.
- Edit or delete a workout.
- Browse every logged workout, grouped by day. Today is included, under the heading Today.
- On Train, save a gym routine, start it, and log kg and reps. Each set shows the numbers from the last time you did that exercise. Personal bests are marked when you finish, and each exercise has a progress chart.

Lists use British dates, for example Sunday, 15 November 2026, and 24-hour times. The start control in the form follows the language and clock already set on the iPhone.

After the first successful load, the app works with no signal.

## PIN

The first time you open Fitness on a phone, you choose a PIN of 4 to 6 digits. After that, Fitness asks for the PIN when you open it, and again if you come back after it has been in the background for 3 minutes. The workouts are not shown until the PIN is entered.

The PIN protects the copy on that phone only. Fitness is a static website: anyone who opens the link gets their own empty copy and chooses their own PIN. Your PIN is not an account, it is not sent anywhere, and it does not unlock someone else's phone. The phone stores a salted hash of the PIN, not the PIN itself.

In Settings, Change PIN asks for the current PIN first.

If you forget the PIN, choose Forgotten PIN, then Reset app. That removes the PIN and every workout stored on this phone. You cannot export a backup while Fitness is locked, so the workouts are gone unless you already saved a backup. After five wrong tries, Fitness waits longer before the next try.

## Add it to your iPhone

Use Safari. Add to Home Screen is not offered the same way in Chrome on an iPhone.

1. Open this site in Safari.
2. Tap the Share button (the square with an arrow pointing up).
3. Scroll the share sheet and tap **Add to Home Screen**.
4. Leave the name as Fitness, then tap **Add**.

The Fitness icon appears on the home screen. Open it from there, like any other app. The first open needs a connection so the phone can save the pages. Later opens work offline.

When GitHub Pages is allowed for this repository, the address is:

`https://84tjbkz9pv-gif.github.io/Fitness-app/`

### Where the workouts live

Workouts are stored only in this browser on this phone, using the browser's own database (IndexedDB). They are not sent anywhere unless you export a backup.

Deleting that data deletes the workouts. On the iPhone that is Settings → Apps → Safari → Advanced → Website Data, then remove this site. Removing the home-screen icon does not by itself delete the data, but clearing the site data does. There is no account to restore them from.

### Backup

Tap **Backup**, then **Export backup**. On the iPhone the share sheet opens. Save the file to Files, or to Google Drive if Drive is in the share sheet.

**Import backup** reads that file and replaces the workouts on this phone. Anything on the phone that is not in the file is removed.

The file is one JSON document, version 1, with the date it was exported and the list of workouts. A later version will be able to put that same file in a Google Drive folder for you. This version does not sign in to Google.

## GitHub Pages

`.github/workflows/pages.yml` publishes the site when commits land on `main`. It runs the unit tests, then deploys the pages with GitHub's Pages actions.

[GitHub's Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) says Pages is available for public repositories on GitHub Free, and for private repositories only with GitHub Pro, Team, or Enterprise. Making this repository public lets that workflow publish the site from `main`. Publishing does not share the workouts: each phone still has its own empty copy.

## Tests

From this folder, with Node.js 20 or later and no packages to install:

```
node --test
```

`npm test` runs the same command. The autumn clock-change test also runs when the time zone is `Europe/London`:

```
TZ=Europe/London node --test
```

## Look at it on a computer

From this folder:

```
python3 -m http.server
```

Open the address it prints. Do not open `index.html` as a file. The offline copy needs a normal web address.
