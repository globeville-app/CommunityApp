# Testing the app on your phone (Windows)

A step-by-step guide to running the real app: the **server** on your Windows
computer and the **app** on your iPhone through **Expo Go**. Written from a
real first run, including every snag we hit and how to get past it.

- **First time:** about 45 minutes, mostly installs.
- **Every time after:** about 2 minutes ("Starting it again" below).
- **You need:** a Windows computer and an iPhone on the **same Wi-Fi**.

> The computer must stay on, with two PowerShell windows open, while you use
> the app. Close them when you're done; nothing is lost.

---

## Part 1: One-time setup

### 1. Install the tools

| On | Install | Notes |
| --- | --- | --- |
| Computer | **Python 3.12 or newer**, from python.org/downloads | On the first install screen, tick **"Add Python to PATH"** |
| Computer | **Node.js LTS**, from nodejs.org | Accept the defaults |
| iPhone | **Expo Go**, from the App Store | Free |
| Both | A free **Expo account**, from expo.dev/signup | Newer Expo Go won't open projects without it |

### 2. Download the code and extract it

The repository is private, so download it in a browser where you're signed in
to GitHub.

1. Open **github.com/indubitably-dubin/CommunityApp-Milestone-1** (branch **main**).
2. Click the green **Code** button → **Download ZIP**.
3. In **Downloads**, **right-click** the ZIP → **Extract All…** → **Extract**.

> **Snag: browsing the ZIP isn't extracting it.** Windows lets you open a ZIP
> like a folder. If you see a pink **"Compressed Folder Tools"** tab or a
> **"Compressed size"** column, you're still inside the ZIP, and nothing
> will run. Use **Extract All** first.

After extracting, the project is usually here (note the folder name twice):

```
Downloads\CommunityApp-Milestone-1-main\CommunityApp-Milestone-1-main\
```

### 3. Open PowerShell in the `backend` folder

1. In File Explorer, open the **extracted** `backend` folder (you'll see `manage.py`).
2. Click the **address bar**, type `powershell`, press **Enter**.
3. The prompt should end in **`\backend>`**. If it says `PS C:\>`, you weren't
   in the extracted folder; go back to step 2.

### 4. Set up the server

> **Snag: paste ONE line at a time.** Paste a line, press **Enter**, and wait
> for the `PS …>` prompt to come back before the next one. If you paste
> several lines at once you'll see `>>` and nothing runs; press **Ctrl + C**
> and start again.

| # | Paste this | You should see |
| --- | --- | --- |
| 1 | `py -m venv .venv` | Nothing, then the prompt returns |
| 2 | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` | A question; type `Y`, press Enter |
| 3 | `.venv\Scripts\Activate.ps1` | The prompt now starts with **`(.venv)`** |
| 4 | `pip install -r requirements.txt` | A lot of text, ending in "Successfully installed…" |
| 5 | `python manage.py migrate` | A list of lines ending in `OK` |
| 6 | `python manage.py load_neighborhoods` | **"Loaded 78 neighborhoods"** |
| 7 | `python manage.py runserver 0.0.0.0:8000` | "Starting development server at http://0.0.0.0:8000/", and it **keeps running** |

Step 2 is needed once per computer. Without it, step 3 fails with
"running scripts is disabled on this system".

When step 7 starts, **Windows Firewall** asks about Python:
- tick ☑ **Private networks**,
- untick ☐ **Public networks**,
- click **Allow access**.

Leave this window open. It's the server.

### 5. Find your computer's Wi-Fi address

Open a **second** PowerShell (Start → type `PowerShell`) and run:

```
ipconfig
```

Under **Wireless LAN adapter Wi-Fi**, note the **IPv4 Address**, for example
`10.0.0.29`. Below, replace `10.0.0.29` with yours.

### 6. Check the phone can reach the server

1. On the **computer**, open `http://localhost:8000/api/config` in a browser.
   You should see a line with `"app_name":"Globeville"` and the interests.
2. On the **iPhone**, on the same Wi-Fi, open `http://10.0.0.29:8000/api/config`
   in Safari. You should see the same line.

> **Snag: works on the computer but the phone says "server stopped responding".**
> Windows is blocking the phone. Fix it in this order, retrying after each:
>
> 1. **Settings → Network & Internet → Wi-Fi →** your network →
>    **Network profile: Private**.
> 2. Check the phone is on the same network: iPhone **Settings → Wi-Fi → ⓘ**.
>    Its IP Address should start the same way as the computer's (e.g. `10.0.0.`).
> 3. Open **PowerShell as administrator** (Start → type `PowerShell` →
>    right-click → **Run as administrator**) and run this one line:
>    ```
>    New-NetFirewallRule -DisplayName "Globeville dev server (port 8000)" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
>    ```
>    This opens only port 8000, only on private networks. You can remove it
>    later in **Windows Defender Firewall → Advanced settings → Inbound Rules**.

### 7. Set up the app

In the **second** PowerShell window:

| # | Paste this | You should see |
| --- | --- | --- |
| 1 | `cd "$HOME\Downloads\CommunityApp-Milestone-1-main\CommunityApp-Milestone-1-main\mobile"` | The prompt ends in **`\mobile>`** |
| 2 | `node -v` | A version like `v22.x.x` |
| 3 | `Set-Content -Path .env -Value "API_BASE_URL=http://10.0.0.29:8000"` | Nothing (it creates the settings file) |
| 4 | `npm install` | A few minutes of text; yellow "warn" lines are fine |
| 5 | `npx expo login` | Enter your Expo username/email and password; it says "Logged in as …" |
| 6 | `npx expo whoami` | Your Expo username |
| 7 | `npx expo start` | A large **QR code** |

If the firewall asks about **Node.js**, again choose **Private networks** only.

### 8. Open the app on the iPhone

1. Open **Expo Go** and sign in with the **same Expo account**.
2. Open the iPhone **Camera**, point it at the QR code, tap **Open in Expo Go**.
3. If asked to find devices on your **local network**, tap **Allow**.

> **Snag: "You need to be signed in to Expo Go and Expo CLI".** Both the phone
> and the computer must be signed in to the same Expo account, and Expo must
> be started *after* signing in. Press **Ctrl + C** in the Expo window, run
> `npx expo login`, check with `npx expo whoami`, then `npx expo start` again.

> **The first load is slow** (a minute or two). Expo builds the whole app
> on the computer while the phone waits; watch the `iOS Bundling …%` line.
> Later loads are much faster. If it's always slow, run `npx expo start -c`
> to clear the cache, and stay close to the router.

---

## Part 2: What to test

1. **Sign up** with an email and a password of 8+ characters.
2. Enter **your real address**. It goes to the Census address lookup and
   Denver's official neighborhood map.
3. A panel slides up with your neighborhood. If offered (e.g. Highland/LoHi),
   pick the name you use, then **Join**.
4. Enter your first and last name, optionally a photo and interests, then
   **Finish**.
5. Your profile shows "First L.", your neighborhood and interests.
6. **Close Expo Go completely** (swipe it away), reopen the project: you
   should still be logged in on your profile.
7. Optional: an address in Aurora or Lakewood should say the app is
   "only in the City and County of Denver for now".
8. **Spanish:** tap **Español** at the top right (it's on every screen
   before you join, and in the "Language / Idioma" row on your profile).
   The whole app switches at once, and anything you've typed stays. Close
   and reopen Expo Go, log out and back in: it stays in Spanish. If your
   iPhone itself is set to Spanish, a brand-new install starts in Spanish.
9. **Settings:** on your profile, tap the **gear** (top right). Try
   **Edit profile**, the language switch, **Privacy policy** (shows "Coming
   soon" for now) and **Log out** (it asks first).
10. **Report a problem:** in Settings, write a message, add a screenshot and
    tap **Send**. To see the team email, stop the server (Ctrl+C) and start
    it with your address, one line:
    `$env:PROBLEM_REPORT_EMAILS="you@example.com"; python manage.py runserver 0.0.0.0:8000`
    The email is printed in the server window (it isn't really sent while
    testing). Then, in the server window's folder, run
    `python manage.py createsuperuser` once (in a second PowerShell window,
    after `.venv\Scripts\Activate.ps1`), open
    `http://localhost:8000/admin/` on the computer, and find the report
    under **Problem reports**, with its screenshot.
11. **Delete account:** sign up a second, test account, then Settings →
    **Delete account**, enter its password. You'll see "Your account was
    deleted." and can't log in with it any more.

Watching the **server window** while you test is useful: each action
appears as a line such as `"PUT /api/profile HTTP/1.1" 201`. Photo uploads
also log their size and how long they took. Your address never appears
there.

---

## Starting it again later

**Server:** open PowerShell in the `backend` folder, then one line at a time:
```
.venv\Scripts\Activate.ps1
```
```
python manage.py runserver 0.0.0.0:8000
```

**App:** open a second PowerShell, then one line at a time:
```
cd "$HOME\Downloads\CommunityApp-Milestone-1-main\CommunityApp-Milestone-1-main\mobile"
```
```
npx expo start
```
Scan the QR code with the iPhone Camera.

If your computer's Wi-Fi address changed (new network, router restart),
re-run `ipconfig` and repeat Part 1 step 7, line 3 with the new address,
then restart Expo.

## Stopping

Press **Ctrl + C** in each window, then close them. Your account, profile
and photos stay in the `backend` folder for next time.

## Getting a newer version of the code

Download and extract the ZIP again (Part 1, step 2), then repeat Part 1
steps 3–4 (skip the `Set-ExecutionPolicy` line) and step 7. A fresh ZIP
starts with an empty database, so you'll sign up again.

---

## On a Mac instead

The same steps, with these differences:
- Open Terminal in a folder: right-click the folder → **New Terminal at Folder**.
- Use `python3 -m venv .venv` and `source .venv/bin/activate`; skip `Set-ExecutionPolicy`.
- Find the Wi-Fi address with `ipconfig getifaddr en0`.
- Create the settings file with `echo "API_BASE_URL=http://YOUR-IP:8000" > .env`.
- If macOS asks whether Python may accept incoming connections, click **Allow**.
