# Owen Sound canvassing accounts

Restart the canvassing API once after deploying this change so migrations 13,
14, 15, and 16 are applied. The canvassing server is online-first. Map assets may
be cached by the browser,
but recording visits and flyer deliveries requires connectivity to the central
canvassing API and SQLite database.

## Create the initial accounts

Start the server once so the authentication migration is applied, stop it while
creating the initial accounts from a private terminal, and then start it again.
Password entry is hidden and passwords are
not written to the repository or application logs.

```sh
npm run canvassing:user:create -- andrii --role candidate --display-name Andrii
npm run canvassing:user:create -- rynaldo --role volunteer --display-name Rynaldo
```

The command prompts twice for each password. The database path can be changed
with `CANVASS_DB` when operating on a non-default deployment.

To reset a password and invalidate that user's existing sessions:

```sh
npm run canvassing:user:password -- rynaldo
```

Users log in at `/canvassing/`. The account role controls access; the browser
cannot promote a volunteer to candidate mode. Both accounts use the same
campaign-wide `Find next area` recommendation and coverage database.

The checked-in Compose deployment serves its private web UI over HTTP on
localhost, so it sets `CANVASS_SECURE_COOKIES=false`. Set
`CANVASS_SECURE_COOKIES=true` when the deployment is served over HTTPS.

## Known limits

There are no route assignments, route ownership records, or long-running route
reservations. A Find next area request creates an invisible 30-minute
recommendation hold containing the selector's actual household sample. The
hold is replaced when that user requests again and is refreshed to 30 minutes
from each meaningful visit, flyer delivery, or household conversation inside
the held sample. Activity outside the sample does not refresh it; after the
last matching activity it expires automatically. The SQLite write transaction
covers selection and hold creation, so near-simultaneous requests normally
receive separate areas. If all alternatives are temporarily held, the normal
recommendation is retained as a last resort; the existing same-flyer duplicate
protection remains the authoritative safeguard.

The hold duration can be changed for controlled operations or tests with
`CANVASS_RECOMMENDATION_HOLD_MINUTES`; leave it unset for the 30-minute
default. Holds are coordination hints only and are not route ownership.

Offline visit/flyer synchronization is not implemented. A visit or flyer
delivery must be submitted while connected to the central API.

The selector still treats any qualifying flyer delivery as coverage. Whether a
household that received an earlier flyer should become eligible for the current
flagship flyer is a separate campaign-policy decision.

## Administer campaign users

An authenticated candidate account can open **Users** from the canvassing map,
or directly at `/canvassing/admin/users`. Volunteers cannot read or modify the
user list through the API or the page. The page supports adding an account,
editing its display name/email/role, disabling or enabling it, resetting its
password, and viewing operational contribution totals. Accounts are disabled
rather than deleted so historical attribution remains intact.

Candidates can also open the **Lawn signs** worklist at
`/canvassing/admin/lawn-signs` to search households and record lawn-sign
interest using the existing canvassing visit outcome. See
`docs/owen-sound-canvassing-lawn-signs.md` for the workflow.

When Andrii adds a volunteer, the server generates a fresh password using
`crypto.randomInt()` and an unambiguous alphabet (20 random characters, over
100 bits of entropy before formatting). Only the Argon2id password hash is
stored. The plaintext password is returned to the authenticated admin once in
the account-creation/reset response so it can be copied; it is not retrievable
after a refresh and is never written to the database, journal, audit detail,
logs, or browser storage. Generated passwords are secure by default and users
are not required to change them. A user may voluntarily use **Change password**
from the map account controls; chosen passwords must be at least 14 characters.

The normal volunteer setup is:

1. Open **Users**.
2. Click **Add User** and enter the display name, username, optional email, and
   volunteer role.
3. Leave **Email credentials to me** selected if Andrii will forward them, or
   choose direct delivery when the volunteer email is present.
4. Copy the one-time password if delivery fails, then give the credentials to
   the volunteer privately.

Credential email requires the following deployment environment variables:

```text
CANVASSING_SMTP_HOST=smtp.example.org
CANVASSING_SMTP_PORT=587
CANVASSING_SMTP_SECURE=false
CANVASSING_SMTP_USER=...
CANVASSING_SMTP_PASSWORD=...
CANVASSING_FROM_EMAIL=canvassing@example.org
CANVASSING_ADMIN_EMAIL=andrii@example.org
CANVASSING_REPLY_TO_EMAIL=andrii@example.org
CANVASSING_LOGIN_URL=https://campaign.example.org/canvassing
CANVASSING_BASE_URL=https://campaign.example.org
```

`CANVASSING_SMTP_USER` may be omitted for an unauthenticated SMTP relay. Do
not commit these values or place them in source control. If the mail settings
are absent or delivery fails, the account remains created and the password is
shown once in the authenticated admin response; the failure is recorded
without the password. The normal recovery action is **Reset password** and
email again. The default admin-forwarding destination is
`CANVASSING_ADMIN_EMAIL`; direct delivery requires the account email.

The existing CLI remains the fallback and bootstrap path. If no candidate
account exists, create the first admin privately with the existing command:

```sh
npm run canvassing:user:create -- andrii --role candidate --display-name Andrii
```

The CLI prompts for a password and never emails it. It is also available for
emergency password reset:

```sh
npm run canvassing:user:password -- rynaldo
```

For ordinary volunteer management, use the authenticated Users page. No
production account is created by the application migration or test suite.
