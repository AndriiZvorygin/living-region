import "./canvassing.css";
import "./canvassing-admin.css";

type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: "candidate" | "volunteer";
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  current_flagship_flyers: number;
  total_flyer_deliveries: number;
  visits: number;
  first_field_activity: string | null;
  last_field_activity: string | null;
  last_active: string | null;
};

type AuthUser = Pick<AdminUser, "id" | "username" | "display_name" | "email" | "role">;

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ]!,
  );

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "Never";

async function currentUser() {
  const response = await fetch("/api/me", { credentials: "same-origin" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await response.text());
  return ((await response.json()) as { user: AuthUser }).user;
}

async function login(purpose = "manage campaign users"): Promise<AuthUser> {
  document.title = "Log in · Owen Sound Canvassing";
  document.body.innerHTML = `<main class="auth-shell"><form class="auth-card" id="admin-login-form"><h1>Owen Sound Canvassing</h1><p>Log in to ${escapeHtml(purpose)}.</p><label>Username<input name="username" autocomplete="username" required autofocus></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p class="auth-error" id="admin-login-error" role="alert"></p><button>Log in</button></form></main>`;
  const form = document.querySelector<HTMLFormElement>("#admin-login-form")!;
  const error = document.querySelector<HTMLElement>("#admin-login-error")!;
  return new Promise((resolve) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector<HTMLButtonElement>("button")!;
      button.disabled = true;
      error.textContent = "";
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Login failed");
        resolve(result.user as AuthUser);
      } catch (loginError) {
        error.textContent = loginError instanceof Error ? loginError.message : "Login failed";
        button.disabled = false;
      }
    });
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result as T;
}

function suggestedUsername(displayName: string) {
  const value = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return /^[a-z]/.test(value) ? value : value ? `user-${value}`.slice(0, 64) : "volunteer";
}

export async function canvassingAdminMain() {
  let user = await currentUser();
  if (!user) user = await login();
  if (user.role !== "candidate") {
    document.body.innerHTML = `<main class="auth-shell"><section class="auth-card"><h1>Users</h1><p>Candidate access is required to manage campaign accounts.</p><a href="/canvassing/">Return to canvassing</a></section></main>`;
    return;
  }
  document.title = "Users · Owen Sound Canvassing";
  document.body.innerHTML = `<main class="admin-shell">
    <header class="admin-header"><div><strong>Owen Sound Canvassing</strong><span>User administration</span></div><nav><a href="/canvassing/">Map</a><a href="/canvassing/admin/lawn-signs">Lawn signs</a><details class="admin-account-menu"><summary>${escapeHtml(user.display_name)} · Candidate</summary><div><button id="admin-logout">Log out</button></div></details></nav></header>
    <section class="admin-content">
      <div class="admin-page-heading"><div><h1>Users</h1><p>Manage campaign accounts and view operational contribution totals.</p></div><button id="add-user-toggle">Add User</button></div>
      <p class="admin-message" id="admin-message" role="status"></p>
      <section class="credential-result" id="credential-result" hidden><div><strong>Account credentials</strong><span>This password will not be shown again.</span></div><dl><dt>Username</dt><dd id="credential-username"></dd><dt>Password</dt><dd id="credential-password"></dd></dl><button id="copy-credentials">Copy credentials</button></section>
      <form class="admin-card admin-add-form" id="add-user-form" hidden><h2>Add User</h2><div class="admin-form-grid"><label>Display name<input id="new-display-name" name="display_name" required placeholder="Rynaldo"></label><label>Username<input id="new-username" name="username" required placeholder="rynaldo"></label><label>Email <small id="new-email-help">required for direct delivery</small><input id="new-email" name="email" type="email" autocomplete="email"></label><label>Role<select name="role"><option value="volunteer" selected>Volunteer</option><option value="candidate">Candidate / admin</option></select></label><label>Credential delivery<select id="new-delivery" name="delivery"><option value="volunteer" selected>Email directly to volunteer</option><option value="admin">Email credentials to me</option></select></label></div><p class="admin-help">Direct delivery is selected by default. Choose email to me if you plan to forward the credentials. A strong password will be generated automatically.</p><div class="admin-form-actions"><button type="submit">Create account</button><button type="button" id="cancel-add-user">Cancel</button></div></form>
      <section class="admin-card"><div class="admin-table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Flagship flyers</th><th>Total flyers</th><th>Visits</th><th>Last active</th><th>Actions</th></tr></thead><tbody id="users-list"></tbody></table></div></section>
      <details class="admin-card"><summary>Change my password</summary><form id="self-password-form" class="admin-form-grid"><label>Current password<input name="current_password" type="password" autocomplete="current-password" required></label><label>New password<input name="new_password" type="password" autocomplete="new-password" minlength="14" required></label><label>Confirm new password<input name="confirm_password" type="password" autocomplete="new-password" minlength="14" required></label><button>Change password</button></form></details>
    </section>
  </main>`;

  const message = document.querySelector<HTMLElement>("#admin-message")!;
  const resultBox = document.querySelector<HTMLElement>("#credential-result")!;
  const setMessage = (text: string, error = false) => {
    message.textContent = text;
    message.dataset.tone = error ? "error" : "success";
  };
  const showCredentials = (result: any) => {
    document.querySelector("#credential-username")!.textContent = result.user.username;
    document.querySelector("#credential-password")!.textContent = result.temporary_password;
    resultBox.hidden = false;
    setMessage(
      result.delivery?.status === "sent"
        ? `Credentials emailed to ${result.delivery.recipient}.`
        : result.delivery?.message ?? "Account created; copy the password below.",
      result.delivery?.status !== "sent",
    );
  };
  document.querySelector("#copy-credentials")!.addEventListener("click", async () => {
    const credentials = `Username: ${document.querySelector("#credential-username")!.textContent}\nPassword: ${document.querySelector("#credential-password")!.textContent}`;
    await navigator.clipboard?.writeText(credentials);
    setMessage("Credentials copied. Keep them private.");
  });

  const renderUsers = (users: AdminUser[]) => {
    document.querySelector<HTMLTableSectionElement>("#users-list")!.innerHTML = users
      .map(
            (account) => `<tr data-user-id="${escapeHtml(account.id)}"><td><input data-user-field="display_name" value="${escapeHtml(account.display_name)}"><small>${escapeHtml(account.username)}</small><input data-user-field="email" type="email" value="${escapeHtml(account.email ?? "")}" placeholder="Email (optional)"><details class="admin-user-details"><summary>Details</summary><span>Created: ${escapeHtml(date(account.created_at))}</span><span>First field activity: ${escapeHtml(date(account.first_field_activity))}</span></details></td><td><select data-user-field="role"><option value="volunteer" ${account.role === "volunteer" ? "selected" : ""}>Volunteer</option><option value="candidate" ${account.role === "candidate" ? "selected" : ""}>Candidate</option></select></td><td><label class="admin-status"><input data-user-field="active" type="checkbox" ${account.active ? "checked" : ""}> ${account.active ? "Active" : "Disabled"}</label></td><td>${account.current_flagship_flyers.toLocaleString()}</td><td>${account.total_flyer_deliveries.toLocaleString()}</td><td>${account.visits.toLocaleString()}</td><td>${escapeHtml(date(account.last_active))}</td><td class="admin-row-actions"><button data-save-user>Save</button><select data-reset-delivery aria-label="Credential delivery">${account.email ? '<option value="volunteer" selected>Email to user</option>' : ""}<option value="admin" ${account.email ? "" : "selected"}>Email to me</option></select><button data-reset-user>Reset password</button></td></tr>`,
      )
      .join("");
  };
  const refreshUsers = async () => {
    const data = await request<{ users: AdminUser[] }>("/api/admin/users");
    renderUsers(data.users);
  };
  try {
    await refreshUsers();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Users could not be loaded", true);
  }

  const addForm = document.querySelector<HTMLFormElement>("#add-user-form")!;
  const displayInput = document.querySelector<HTMLInputElement>("#new-display-name")!;
  const usernameInput = document.querySelector<HTMLInputElement>("#new-username")!;
  const emailInput = document.querySelector<HTMLInputElement>("#new-email")!;
  const deliveryInput = document.querySelector<HTMLSelectElement>("#new-delivery")!;
  const updateDeliveryRequirement = () => {
    const direct = deliveryInput.value === "volunteer";
    emailInput.required = direct;
    document.querySelector<HTMLElement>("#new-email-help")!.textContent = direct
      ? "required for direct delivery"
      : "optional";
  };
  deliveryInput.addEventListener("change", updateDeliveryRequirement);
  updateDeliveryRequirement();
  let usernameEdited = false;
  displayInput.addEventListener("input", () => {
    if (!usernameEdited) usernameInput.value = suggestedUsername(displayInput.value);
  });
  usernameInput.addEventListener("input", () => {
    usernameEdited = true;
  });
  document.querySelector("#add-user-toggle")!.addEventListener("click", () => {
    addForm.hidden = !addForm.hidden;
    if (!addForm.hidden) displayInput.focus();
  });
  document.querySelector("#cancel-add-user")!.addEventListener("click", () => {
    addForm.reset();
    updateDeliveryRequirement();
    usernameEdited = false;
    addForm.hidden = true;
  });
  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const created = await request<any>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(addForm))),
      });
      showCredentials(created);
      addForm.reset();
      updateDeliveryRequirement();
      usernameEdited = false;
      addForm.hidden = true;
      await refreshUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account creation failed", true);
    }
  });

  document.querySelector("#users-list")!.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLTableRowElement>("tr[data-user-id]");
    if (!row) return;
    const userId = row.dataset.userId!;
    try {
      if (target.closest("[data-save-user]")) {
        const value = (field: string) => row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-user-field="${field}"]`)!;
        await request(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            display_name: value("display_name").value,
            email: value("email").value,
            role: value("role").value,
            active: (value("active") as HTMLInputElement).checked,
          }),
        });
        setMessage("User updated.");
        await refreshUsers();
      }
      if (target.closest("[data-reset-user]")) {
        if (!window.confirm("Generate a new password and invalidate the old one?")) return;
        const delivery = row.querySelector<HTMLSelectElement>("[data-reset-delivery]")!.value;
        const reset = await request<any>(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
          method: "POST",
          body: JSON.stringify({ delivery }),
        });
        showCredentials(reset);
        await refreshUsers();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User action failed", true);
    }
  });

  document.querySelector<HTMLFormElement>("#self-password-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await request("/api/me/password", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement))),
      });
      (event.currentTarget as HTMLFormElement).reset();
      setMessage("Your password was changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password change failed", true);
    }
  });
  document.querySelector("#admin-logout")!.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.reload();
  });
}

type LawnSignHousehold = {
  household_id: string;
  address_id: string;
  structure_id: string | null;
  unit: string;
  unit_count: number;
  address_label: string;
  contact_person_id: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
};

type LawnSignEntry = Omit<LawnSignHousehold, "contact_person_id"> & {
  first_approved_at: string;
  last_approved_at: string;
  approval_count: number;
  latest_source: string;
  latest_recorded_by: string;
};

export async function canvassingLawnSignsAdminMain() {
  let user = await currentUser();
  if (!user) user = await login("manage lawn-sign records");
  if (user.role !== "candidate") {
    document.body.innerHTML = `<main class="auth-shell"><section class="auth-card"><h1>Lawn signs</h1><p>Candidate access is required to manage lawn-sign records.</p><a href="/canvassing/">Return to canvassing</a></section></main>`;
    return;
  }
  document.title = "Lawn signs · Owen Sound Canvassing";
  document.body.innerHTML = `<main class="admin-shell">
    <header class="admin-header"><div><strong>Owen Sound Canvassing</strong><span>Lawn-sign database</span></div><nav><a href="/canvassing/">Map</a><a href="/canvassing/admin/users">Users</a><details class="admin-account-menu"><summary>${escapeHtml(user.display_name)} · Candidate</summary><div><button id="admin-logout">Log out</button></div></details></nav></header>
    <section class="admin-content">
      <div class="admin-page-heading"><div><h1>Lawn-sign approvals</h1><p>Locations where lawn-sign interest has been recorded or entered by the campaign.</p></div></div>
      <p class="admin-help">This is an operational interest list, not proof that a sign has been installed. Entries remain connected to the canvassing household and its history.</p>
      <section class="admin-stat-grid"><div class="admin-stat"><strong id="sign-count">0</strong><span>Recorded approvals</span></div><div class="admin-stat"><strong id="sign-contact-count">0</strong><span>With contact details</span></div></section>
      <p class="admin-message" id="sign-message" role="status"></p>
      <section class="admin-card"><h2>Add a lawn-sign approval</h2><p class="admin-help">Search by address, household ID, or contact name. Choose the real household first; the map and canvassing history stay linked.</p><div class="admin-search-row"><input id="sign-search" type="search" placeholder="Search 254 8th Street or a name" autocomplete="off"><button id="sign-search-button" type="button">Search</button></div><div id="sign-household-results" class="admin-search-results"></div><form id="sign-entry-form" class="admin-card admin-sign-entry" hidden><h3 id="sign-selected-address"></h3><p id="sign-selected-units" class="admin-help"></p><div class="admin-form-grid"><label>Contact name <small>optional</small><input id="sign-contact-name" autocomplete="name"></label><label>Phone <small>optional</small><input id="sign-contact-phone" type="tel" autocomplete="tel"></label><label>Email <small>optional</small><input id="sign-contact-email" type="email" autocomplete="email"></label></div><div class="admin-form-actions"><button type="submit">Record approval</button><button type="button" id="sign-cancel-entry">Cancel</button></div></form></section>
      <section class="admin-card"><div class="admin-section-heading"><h2>Recorded approvals</h2><button id="sign-refresh" type="button">Refresh</button></div><div class="admin-table-wrap"><table class="admin-sign-table"><thead><tr><th>Contact</th><th>Address</th><th>Last recorded</th><th>Recorded by</th><th>Signals</th></tr></thead><tbody id="sign-list"></tbody></table></div></section>
    </section>
  </main>`;

  const message = document.querySelector<HTMLElement>("#sign-message")!;
  const searchInput = document.querySelector<HTMLInputElement>("#sign-search")!;
  const searchButton = document.querySelector<HTMLButtonElement>("#sign-search-button")!;
  const searchResults = document.querySelector<HTMLElement>("#sign-household-results")!;
  const entryForm = document.querySelector<HTMLFormElement>("#sign-entry-form")!;
  const selectedAddress = document.querySelector<HTMLElement>("#sign-selected-address")!;
  const selectedUnits = document.querySelector<HTMLElement>("#sign-selected-units")!;
  const contactName = document.querySelector<HTMLInputElement>("#sign-contact-name")!;
  const contactPhone = document.querySelector<HTMLInputElement>("#sign-contact-phone")!;
  const contactEmail = document.querySelector<HTMLInputElement>("#sign-contact-email")!;
  let selected: LawnSignHousehold | null = null;
  let searchHouseholds: LawnSignHousehold[] = [];
  let selectedContactSnapshot = { name: "", phone: "", email: "" };

  const setMessage = (text: string, error = false) => {
    message.textContent = text;
    message.dataset.tone = error ? "error" : "success";
  };
  const renderSearchResults = (households: LawnSignHousehold[]) => {
    searchResults.innerHTML = households.length
      ? households
          .map(
            (household) => `<button type="button" class="admin-search-result" data-household-id="${escapeHtml(household.household_id)}"><strong>${escapeHtml(household.address_label || "Address unavailable")}</strong><span>${household.unit_count > 1 ? `${household.unit_count} known units · ` : ""}${escapeHtml(household.contact_name || "No contact name")}${household.contact_email ? ` · ${escapeHtml(household.contact_email)}` : ""}</span></button>`,
          )
          .join("")
      : `<p class="admin-help">No current canvassing household matched that search.</p>`;
  };
  const renderEntries = (entries: LawnSignEntry[]) => {
    document.querySelector<HTMLElement>("#sign-count")!.textContent = entries.length.toLocaleString();
    document.querySelector<HTMLElement>("#sign-contact-count")!.textContent = entries
      .filter((entry) => entry.contact_name || entry.contact_phone || entry.contact_email)
      .length.toLocaleString();
    document.querySelector<HTMLTableSectionElement>("#sign-list")!.innerHTML = entries.length
      ? entries
          .map(
            (entry) => `<tr><td><strong>${escapeHtml(entry.contact_name || "No contact name")}</strong><small>${escapeHtml([entry.contact_phone, entry.contact_email].filter(Boolean).join(" · "))}</small></td><td><strong>${escapeHtml(entry.address_label || "Address unavailable")}</strong><small>${entry.unit_count > 1 ? `${entry.unit_count} known units` : ""}</small></td><td>${escapeHtml(date(entry.last_approved_at))}<small>First: ${escapeHtml(date(entry.first_approved_at))}</small></td><td>${escapeHtml(entry.latest_recorded_by)}</td><td>${entry.approval_count.toLocaleString()} · ${escapeHtml(entry.latest_source)}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="5">No lawn-sign approvals recorded yet.</td></tr>`;
  };
  const load = async (query = "") => {
    const data = await request<{ entries: LawnSignEntry[]; households: LawnSignHousehold[]; note: string }>(
      `/api/admin/lawn-signs${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    );
    renderEntries(data.entries);
    searchHouseholds = query ? data.households : [];
    if (query) renderSearchResults(searchHouseholds);
  };
  const doSearch = async () => {
    const query = searchInput.value.trim();
    if (!query) {
      searchResults.innerHTML = `<p class="admin-help">Enter an address, household ID, or contact name to find a household.</p>`;
      return;
    }
    searchButton.disabled = true;
    try {
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Households could not be searched", true);
    } finally {
      searchButton.disabled = false;
    }
  };
  searchButton.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void doSearch();
    }
  });
  searchResults.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-household-id]");
    if (!button) return;
    const household = searchHouseholds.find(
      (candidate) => candidate.household_id === button.dataset.householdId,
    );
    if (!household) return;
    selected = household;
    selectedAddress.textContent = household.address_label || "Address unavailable";
    selectedUnits.textContent = household.unit_count > 1 ? `${household.unit_count} known residential units at this physical location.` : "One canvassing household.";
    contactName.value = household.contact_name;
    contactPhone.value = household.contact_phone;
    contactEmail.value = household.contact_email;
    selectedContactSnapshot = { name: household.contact_name, phone: household.contact_phone, email: household.contact_email };
    entryForm.hidden = false;
    entryForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selected) return;
    const button = entryForm.querySelector<HTMLButtonElement>("button[type=submit]")!;
    button.disabled = true;
    try {
      await request("/api/canvassing/visits", {
        method: "POST",
        body: JSON.stringify({
          submission_key: `admin-lawn-sign-${crypto.randomUUID()}`,
          household_id: selected.household_id,
          outcome: "lawn_sign_interest",
          flyer_delivered: false,
          door_knocked: false,
          conversation_occurred: true,
          issue_categories: [],
          notes: "",
        }),
      });
      const contact = { name: contactName.value.trim(), phone: contactPhone.value.trim(), email: contactEmail.value.trim() };
      if (contact.name || contact.phone || contact.email) {
        const changed = contact.name !== selectedContactSnapshot.name || contact.phone !== selectedContactSnapshot.phone || contact.email !== selectedContactSnapshot.email;
        if (changed)
          await request(`/api/canvassing/households/${encodeURIComponent(selected.household_id)}/contacts`, {
            method: "POST",
            body: JSON.stringify({ ...contact, ...(selected.contact_person_id ? { person_id: selected.contact_person_id } : {}) }),
          });
      }
      setMessage(`Lawn-sign approval recorded for ${selected.address_label}.`);
      selected = null;
      entryForm.reset();
      entryForm.hidden = true;
      searchResults.innerHTML = "";
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lawn-sign approval could not be recorded", true);
    } finally {
      button.disabled = false;
    }
  });
  document.querySelector("#sign-cancel-entry")!.addEventListener("click", () => {
    selected = null;
    entryForm.reset();
    entryForm.hidden = true;
  });
  document.querySelector("#sign-refresh")!.addEventListener("click", () => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Approvals could not be loaded", true));
  });
  document.querySelector("#admin-logout")!.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.reload();
  });
  try {
    await load();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Approvals could not be loaded", true);
  }
}
