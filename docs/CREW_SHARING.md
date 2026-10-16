# Crew sharing — the plan (Ana, 16 Oct 2026)

Goal: Ana's sound crew (boom op, utility…) use soundcheck on their own phones for the NEXT film,
without ever touching GitHub. They see the film; they can suggest changes; only Ana changes the data.
Not a product yet: a small team that Ana trusts.

## Decisions (Ana, 16 Oct)
| Topic | Decision |
|---|---|
| How crew get in | A **link** per person, made by Ana in the app. No login page, no GitHub for them. |
| Key | **One crew key per film** (GitHub fine-grained: Contents read + Issues read/write, that film's repo only). Expires **1 week after the last shooting day**. Ana makes it once at prep. |
| Who is who | The person's **name is inside their link**. Every suggestion is signed with it. |
| What crew can do | See everything of the film. Edit like Ana does — but their changes stay **on their phone, marked "proposed"**, and are sent as suggestions. |
| Who approves | Only Ana (her own key). Crew-facing words never name her: "Change approved", "Change not approved", "Waiting for approval". |
| Removing a person | Soft: Ana marks the name removed → their suggestions are ignored. Hard: regenerate the crew key, re-send links. |
| Feedback | "Enjoyed soundcheck? Share some feedback" — in the menu; offered once by itself near the end of the film. |
| Message log | Each person sees their own suggestions and what happened to each, plus their feedback. Ana sees everyone's. |
| Emails / proposals from production | Stay in the film: the documents are the same for the whole crew. |
| Everyone's calls (`calls.json`) | Stay in the film. |
| Crew phone numbers | Stay in the film. |
| "My call" | Each person chooses: **general crew call**, or **personal call** = their name as printed on the call sheet, matched in `calls.json`. Not found that day → general call + a notice. |
| Hours / timesheet | **Per person.** Ana's sync as today. A crew member's hours stay **on their phone only**, with "Export my timesheet". |
| Wake plan (commute, ride with, sleep) | Per person, not the film's. Nobody's name in the code. |
| Notifications | Per person: personal alerts (wrap question, bedtime, wake) only to that person's phones; film alerts (change approved, new call sheet) to all. iPhone: only after Add to Home Screen. |
| Read aloud | **Removed** (a phone speaking by accident on set is the worst case). |
| Personal details in the public code | Removed 16 Oct (mailbox addresses, colleague's name). History not rewritten. |
| One repo per film | Yes, before the next film, so the crew key only reads that film. |

## How it works

### The link
`https://anachiossi.github.io/soundcheck/#join=<code>`
The code holds owner, repo, branch, the crew key, the person's name and the film folder. The part after `#`
never leaves the phone. On first open the app saves it (like the Connect form does), downloads the film, and
clears the address bar. "Add to Home Screen" → it's an app with their name on it.
Ana makes the link in Projects → **Share with crew** (name + crew key → Copy link).
The link IS a key: send it privately. Anyone holding it can read the film and send suggestions.

### Crew device ("proposed" changes)
Every screen works the same. Saving puts the file in the outbox as today. At sync, a crew device does NOT
commit: for each file in the outbox it works out **what changed** (compared with the version it downloaded)
and sends it as one GitHub **issue** labelled `crew-proposal`, signed with the name. The file stays changed on
the phone, marked "proposed". When the issue is closed (approved or not), the phone drops its local version
and takes the film's version again (which includes the change if it was approved).

### Ana's device (approve)
A banner like the 📬 one: "Davide suggests 2 changes". Each suggestion shows what changes in plain words
(scene 12: Ines lav → DPA 4060 beige; gear: + "Sandbag"), with ✓ Approve / ✕ Don't approve (+ optional
reason). Approving applies the change to Ana's CURRENT data (so her own later edits are kept) and syncs as a
normal save, commit message "… — proposed by Davide, approved". If the same thing changed meanwhile, it says so.

### Issues used
| Label | Written by | What |
|---|---|---|
| `crew-proposal` | crew phone | one changed file: the changes + the version it started from |
| `crew-feedback` | crew phone | the feedback form |
Closed with a comment: `approved` or `not approved: <reason>`.

## What crew don't get
- Projects → Connect form, Disconnect of other devices, Share with crew.
- ✉ email robot badge (they can't run it).
- 🔔 wrap alerts on Ana's push list.
- Ana's wake plan / alarms card and Help → Alarms (until the wake plan is per person).

## Order of the build (branch `claude/crew-sharing`, not live until Ana merges)
1. Remove read aloud.
2. Crew link: Share with crew (Ana) + joining (crew).
3. Crew sync: outbox → suggestions; closed → back to the film's version.
4. Ana's inbox: approve / don't approve.
5. Crew screens: hidden personal parts, neutral words, message log, feedback.
6. "My call" + crew hours on the phone.
Later (needs the next film's setup): one repo per film; per-person notifications in the robots; wake plan
per person.

## Prep for a new film (Ana)
1. GitHub → Settings → Developer settings → Fine-grained tokens → "Crew – <film>": only that film's repo;
   Contents **Read**, Issues **Read and write**; expiry = last shooting day + 1 week.
2. In the app: Projects → Share with crew → paste the key once.
3. Per person: name → Copy link → WhatsApp it privately.
4. At wrap the key expires by itself; their app says "crew access ended".
