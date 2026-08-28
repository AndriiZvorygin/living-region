# Lawn-sign approvals

Candidates can open `/canvassing/admin/lawn-signs` from the account menu or
the Users page. The page is an administrative worklist built from the existing
canvassing data; it does not create a second lawn-sign ledger.

## Record an approval

1. Search for the civic address, household ID, or contact name.
2. Select the matching household.
3. Optionally enter or update the contact name, phone, and email.
4. Click **Record approval**.

The server appends the existing `lawn_sign_interest` visit outcome with the
authenticated candidate actor and timestamp. Contact details, when supplied,
are saved through the existing append-only contact history. The map and the
admin list therefore refer to the same household and physical roof.

Existing approvals are deduplicated in the worklist by household and show the
first/latest recorded dates, signal count, contact details, and recording
actor. The list means that lawn-sign interest was recorded; it does not claim
that a sign has been installed.

Volunteers cannot access the page or its API. Resident contact details remain
within the candidate-only projections.
