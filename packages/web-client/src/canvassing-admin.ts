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

async function login(): Promise<AuthUser> {
  document.title = "Log in · Owen Sound Canvassing";
  document.body.innerHTML = `<main class="auth-shell"><form class="auth-card" id="admin-login-form"><h1>Owen Sound Canvassing</h1><p>Log in to manage campaign users.</p><label>Username<input name="username" autocomplete="username" required autofocus></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><p class="auth-error" id="admin-login-error" role="alert"></p><button>Log in</button></form></main>`;
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
    <header class="admin-header"><div><strong>Owen Sound Canvassing</strong><span>User administration</span></div><nav><a href="/canvassing/">Map</a><details class="admin-account-menu"><summary>${escapeHtml(user.display_name)} · Candidate</summary><div><button id="admin-logout">Log out</button></div></details></nav></header>
    <section class="admin-content">
      <div class="admin-page-heading"><div><h1>Users</h1><p>Manage campaign accounts and view operational contribution totals.</p></div><button id="add-user-toggle">Add User</button></div>
      <p class="admin-message" id="admin-message" role="status"></p>
      <section class="credential-result" id="credential-result" hidden><div><strong>Account credentials</strong><span>This password will not be shown again.</span></div><dl><dt>Username</dt><dd id="credential-username"></dd><dt>Password</dt><dd id="credential-password"></dd></dl><button id="copy-credentials">Copy credentials</button></section>
      <form class="admin-card admin-add-form" id="add-user-form" hidden><h2>Add User</h2><div class="admin-form-grid"><label>Display name<input id="new-display-name" name="display_name" required placeholder="Rynaldo"></label><label>Username<input id="new-username" name="username" required placeholder="rynaldo"></label><label>Email <small>optional</small><input name="email" type="email" autocomplete="email"></label><label>Role<select name="role"><option value="volunteer" selected>Volunteer</option><option value="candidate">Candidate / admin</option></select></label><label>Credential delivery<select name="delivery"><option value="admin" selected>Email credentials to me</option><option value="volunteer">Email directly to volunteer</option></select></label></div><p class="admin-help">A strong password will be generated automatically. It never needs to be changed, but the user may choose to change it later.</p><div class="admin-form-actions"><button type="submit">Create account</button><button type="button" id="cancel-add-user">Cancel</button></div></form>
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
        (account) => `<tr data-user-id="${escapeHtml(account.id)}"><td><input data-user-field="display_name" value="${escapeHtml(account.display_name)}"><small>${escapeHtml(account.username)}</small><input data-user-field="email" type="email" value="${escapeHtml(account.email ?? "")}" placeholder="Email (optional)"><details class="admin-user-details"><summary>Details</summary><span>Created: ${escapeHtml(date(account.created_at))}</span><span>First field activity: ${escapeHtml(date(account.first_field_activity))}</span></details></td><td><select data-user-field="role"><option value="volunteer" ${account.role === "volunteer" ? "selected" : ""}>Volunteer</option><option value="candidate" ${account.role === "candidate" ? "selected" : ""}>Candidate</option></select></td><td><label class="admin-status"><input data-user-field="active" type="checkbox" ${account.active ? "checked" : ""}> ${account.active ? "Active" : "Disabled"}</label></td><td>${account.current_flagship_flyers.toLocaleString()}</td><td>${account.total_flyer_deliveries.toLocaleString()}</td><td>${account.visits.toLocaleString()}</td><td>${escapeHtml(date(account.last_active))}</td><td class="admin-row-actions"><button data-save-user>Save</button><select data-reset-delivery aria-label="Credential delivery"><option value="admin">Email to me</option>${account.email ? '<option value="volunteer">Email to user</option>' : ""}</select><button data-reset-user>Reset password</button></td></tr>`,
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
