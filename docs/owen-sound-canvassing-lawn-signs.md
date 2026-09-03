# Lawn-sign approvals

Candidates can open `/canvassing/admin/lawn-signs` from the account menu or
the Users page. The page is an administrative worklist built from the existing
canvassing data; it does not create a second lawn-sign ledger.

## Record an approval

1. Search for the civic address, household ID, or contact name.
2. Select the matching household, or click **Add new sign location** when the
   address is not yet in the canvassing household list.
3. Enter the name and address exactly as provided.
4. Optionally enter a phone number or email address.
5. Upload the signed approval as a PNG, JPEG, WebP, or PDF (5 MB maximum).
6. Click **Record approval**.

For a selected household, the server appends the existing
`lawn_sign_interest` visit outcome with the authenticated candidate actor and
timestamp. The supplied name/address and private signature are saved with the
approval; contact details, when supplied, are also saved through the existing
append-only contact history. The map and the admin list therefore refer to the
same household and physical roof.

Manual entries are stored as sign approvals without inventing a canvassing
household or map target. They can be linked later when the address foundation
contains the location. Signatures are kept in the private SQLite database and
are visible only to candidate administrators through the authenticated admin
page; they are not placed in map, volunteer, or canvassing responses.

Existing approvals are deduplicated in the worklist by household and show the
first/latest recorded dates, signal count, contact details, and recording
actor. The list means that lawn-sign interest was recorded; it does not claim
that a sign has been installed.

Volunteers cannot access the page or its API. Resident contact details remain
within the candidate-only projections.
