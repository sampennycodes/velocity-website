import { fields, groups, contentSchema } from "../../lib/content/model.js";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let content: any = null,
  saved = "",
  version = 0,
  page = "home",
  group = "home.hero";
let signedIn = false,
  busy = false,
  uploading = false,
  publishing = false,
  publishReady = false;
let email = sessionStorage.getItem("velocity-setup-email") || "",
  viewport = 1280,
  jobId = "",
  publishKey = crypto.randomUUID(),
  historyCursor: string | null = null;
const dirty = () => content && JSON.stringify(content) !== saved;
const notice = (text: string) => {
  $("notice").textContent = text;
};
function updateState() {
  $("save-state").textContent = uploading
    ? "Uploading…"
    : busy
      ? "Saving…"
      : dirty()
        ? "Unsaved changes"
        : "All changes saved";
  $<HTMLButtonElement>("save-button").disabled =
    !signedIn || busy || uploading || !dirty();
  $<HTMLButtonElement>("publish-button").disabled =
    !signedIn || busy || uploading || publishing || dirty() || !publishReady;
}
function showLogin(message: string) {
  $<HTMLDialogElement>("history-dialog").close();
  signedIn = false;
  $("login").hidden = false;
  $("login-message").textContent = message;
  updateState();
}
async function api(action: string, body?: unknown) {
  const response = await fetch(`/api/editor?action=${action}`, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("The service could not respond. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 401)
      showLogin(data.message + " Your unsaved edits are still here.");
    if (response.status === 409) $("conflict").hidden = false;
    throw new Error(data.message || "The request failed. Please try again.");
  }
  return data;
}
async function action(
  button: HTMLButtonElement,
  fn: () => Promise<void>,
  login = false,
) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    await fn();
  } catch (error) {
    if (login) $("login-message").textContent = (error as Error).message;
    else {
      notice((error as Error).message);
      if ($<HTMLDialogElement>("history-dialog").open)
        $("history-message").textContent = (error as Error).message;
    }
  } finally {
    button.disabled = false;
    updateState();
  }
}
function tellPreview() {
  if (content)
    $<HTMLIFrameElement>("page-preview").contentWindow?.postMessage(
      { type: "velocity-content", content },
      location.origin,
    );
}
function focusPreview() {
  $<HTMLIFrameElement>("page-preview").contentWindow?.postMessage(
    { type: "velocity-focus", group },
    location.origin,
  );
}
function sizePreview() {
  const stage = $("preview-stage");
  if (!stage.clientWidth) return;
  const scale = Math.min(1, stage.clientWidth / viewport),
    height = Math.max(450, stage.clientHeight / scale);
  const frame = $<HTMLIFrameElement>("page-preview");
  frame.style.width = viewport + "px";
  frame.style.height = height + "px";
  frame.style.transform = `scale(${scale})`;
  $("preview-sheet").style.width = viewport * scale + "px";
  $("preview-sheet").style.height = height * scale + "px";
}
new ResizeObserver(sizePreview).observe($("preview-stage"));
function changed() {
  updateState();
  tellPreview();
}
function selectGroup(id: string, open = false) {
  if (
    !groups.some((g) => g.id === id && (g.page === page || g.page === "shared"))
  )
    return;
  group = id;
  renderFields();
  $<HTMLSelectElement>("section-picker").value = group;
  document
    .querySelectorAll<HTMLButtonElement>("#section-nav button")
    .forEach((button) =>
      button.setAttribute(
        "aria-current",
        String(button.dataset.group === group),
      ),
    );
  focusPreview();
  if (open) document.body.classList.add("fields-open");
}
function navigation() {
  $("section-nav").replaceChildren();
  $("section-picker").replaceChildren();
  let shared = false;
  for (const g of groups.filter(
    (g) => g.page === page || g.page === "shared",
  )) {
    if (g.page === "shared" && !shared) {
      const label = document.createElement("p");
      label.textContent = "SHARED ACROSS PAGES";
      label.className = "shared-label";
      $("section-nav").append(label);
      shared = true;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = g.label;
    button.dataset.group = g.id;
    button.setAttribute("aria-current", String(g.id === group));
    button.addEventListener("click", () => selectGroup(g.id, true));
    $("section-nav").append(button);
    const option = document.createElement("option");
    option.value = g.id;
    option.textContent = (g.page === "shared" ? "Shared · " : "") + g.label;
    $("section-picker").append(option);
  }
  $<HTMLSelectElement>("section-picker").value = group;
}
function fieldError(key: string) {
  const result = contentSchema.safeParse(content);
  return result.success
    ? ""
    : result.error.issues.find((issue) => issue.path[1] === key)?.message || "";
}
function renderFields() {
  if (!content) return;
  const selected = groups.find((g) => g.id === group)!;
  $("panel-title").textContent = selected.label;
  $("panel-scope").textContent =
    selected.page === "shared"
      ? "SHARED CONTENT"
      : page === "home"
        ? "HOME PAGE"
        : "GOOGLE ADS PAGE";
  $("panel-description").textContent = selected.description || "";
  const form = $("fields-form");
  form.replaceChildren();
  for (const f of fields.filter((f) => f.group === group)) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    const id = "field-" + f.key;
    label.htmlFor = id;
    label.textContent = f.label;
    wrap.append(label);
    const error = document.createElement("small");
    error.id = id + "-error";
    error.setAttribute("role", "status");
    if (f.type === "image") {
      const img = document.createElement("img");
      img.className = "image-thumb";
      img.src = content.values[f.key].src;
      img.alt = content.values[f.key].description;
      wrap.append(img);
      const file = document.createElement("input");
      file.type = "file";
      file.id = id;
      file.accept = "image/jpeg,image/png,image/webp";
      wrap.append(file);
      const helper = document.createElement("p");
      helper.className = "image-meta";
      helper.textContent =
        "JPEG, PNG or WebP · up to 3 MB · private until published";
      wrap.append(helper);
      const altLabel = document.createElement("label");
      altLabel.htmlFor = id + "-alt";
      altLabel.textContent = "Image description";
      altLabel.className = "image-alt";
      wrap.append(altLabel);
      const alt = document.createElement("textarea");
      alt.id = id + "-alt";
      alt.rows = 2;
      alt.maxLength = 500;
      alt.value = content.values[f.key].description;
      alt.setAttribute("aria-describedby", error.id);
      wrap.append(alt);
      alt.addEventListener("input", () => {
        content.values[f.key].description = alt.value;
        img.alt = alt.value;
        error.textContent = fieldError(f.key);
        changed();
      });
      for (const [axis, title] of (f.key === "shared.profile.image" ? [
        ["x", "Horizontal crop"],
        ["y", "Vertical crop"],
      ] : [])) {
        const rangeLabel = document.createElement("label");
        rangeLabel.htmlFor = id + axis;
        rangeLabel.textContent = title;
        wrap.append(rangeLabel);
        const range = document.createElement("input");
        range.type = "range";
        range.id = id + axis;
        range.min = "0";
        range.max = "100";
        range.value = String(content.values[f.key][axis]);
        wrap.append(range);
        range.addEventListener("input", () => {
          content.values[f.key][axis] = Number(range.value);
          img.style.objectPosition = `${content.values[f.key].x}% ${content.values[f.key].y}%`;
          changed();
        });
      }
      const progress = document.createElement("progress");
      progress.max = 100;
      progress.value = 0;
      progress.hidden = true;
      progress.setAttribute("aria-label", "Image upload progress");
      wrap.append(progress);
      const status = document.createElement("p");
      status.className = "upload-status";
      status.setAttribute("role", "status");
      wrap.append(status);
      file.addEventListener("change", () => {
        const upload = file.files?.[0];
        if (!upload) return;
        if (uploading) {
          status.textContent = "Wait for the current upload to finish.";
          return;
        }
        if (upload.size > 3 * 1024 * 1024 || !alt.value.trim()) {
          status.textContent =
            "Choose an image up to 3 MB and add an image description.";
          return;
        }
        uploading = true;
        file.disabled = true;
        updateState();
        progress.hidden = false;
        status.textContent = "Uploading private image…";
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/editor?action=upload");
        xhr.timeout = 60000;
        xhr.setRequestHeader("Content-Type", upload.type);
        xhr.setRequestHeader("X-Image-Name", encodeURIComponent(upload.name));
        xhr.setRequestHeader(
          "X-Image-Description",
          encodeURIComponent(alt.value),
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) progress.value = (e.loaded / e.total) * 100;
        };
        xhr.onload = () => {
          try {
            const result = JSON.parse(xhr.responseText);
            if (xhr.status >= 400) {
              if (xhr.status === 401) showLogin(result.message);
              throw new Error(result.message);
            }
            content.values[f.key] = {
              src: result.url,
              assetId: result.id,
              width: result.width,
              height: result.height,
              description: alt.value,
              x: content.values[f.key].x,
              y: content.values[f.key].y,
            };
            img.src = result.url;
            img.alt = alt.value;
            status.textContent =
              "Uploaded. Save your draft to keep this replacement.";
            changed();
          } catch (e) {
            status.textContent =
              (e as Error).message || "The upload failed. Please try again.";
          }
        };
        xhr.onerror = xhr.ontimeout = () => {
          status.textContent =
            "The upload could not finish. Choose the file again to retry.";
        };
        xhr.onloadend = () => {
          uploading = false;
          file.disabled = false;
          progress.hidden = true;
          file.value = "";
          updateState();
        };
        xhr.send(upload);
      });
    } else {
      const input = document.createElement(
        f.type === "textarea" ? "textarea" : "input",
      ) as HTMLInputElement | HTMLTextAreaElement;
      input.id = id;
      input.value = content.values[f.key];
      input.maxLength = f.max;
      input.required = true;
      input.setAttribute("aria-describedby", error.id);
      if (input instanceof HTMLInputElement)
        input.type = f.type === "email" ? "email" : "text";
      else input.rows = 4;
      input.addEventListener("input", () => {
        content.values[f.key] = input.value;
        error.textContent = fieldError(f.key);
        input.setAttribute("aria-invalid", String(Boolean(error.textContent)));
        changed();
      });
      wrap.append(input);
    }
    error.textContent = fieldError(f.key);
    wrap.append(error);
    form.append(wrap);
  }
}
function acceptDraft(data: any, replace = true) {
  version = data.version;
  saved = JSON.stringify(data.content);
  if (replace) {
    content = data.content;
    renderFields();
    tellPreview();
  }
  $("updated").textContent =
    `Draft ${version} · saved ${new Date(data.updatedAt).toLocaleString()} by ${data.updatedBy}`;
  $("conflict").hidden = true;
  updateState();
}
async function load() {
  const session = await api("session");
  signedIn = true;
  email = session.email;
  $("identity").textContent = session.email;
  $("login").hidden = true;
  $("workspace").hidden = false;
  $("toolbar").hidden = false;
  if (!content) {
    const draft = await api("draft");
    acceptDraft(draft);
    navigation();
  }
  const status = await api("status");
  publishReady = status.publishingConfigured;
  const active = status.publications.find((p: any) =>
    ["preparing", "building", "unknown"].includes(p.status),
  );
  if (active) {
    jobId = active.id;
    publishing = true;
    void checkPublish();
  }
  $("publish-status").textContent = publishReady
    ? "Publishes to staging only."
    : "Staging publishing is not connected yet. Draft editing is available.";
  notice(
    dirty()
      ? "You’re signed back in. Your unsaved edits are still here."
      : "Choose a section to edit. Your saved draft is private until you publish.",
  );
  sizePreview();
  tellPreview();
  updateState();
}
$("email-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void action(
    $("email-form").querySelector("button")!,
    async () => {
      email = $<HTMLInputElement>("email").value.trim().toLowerCase();
      const result = await api("send-code", { email });
      sessionStorage.setItem("velocity-setup-email", email);
      $("login-message").textContent = result.message;
      $("email-form").hidden = true;
      $("code-form").hidden = false;
      $("otp").focus();
    },
    true,
  );
});
$("code-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void action(
    $("code-form").querySelector("button")!,
    async () => {
      await api("verify-code", {
        email,
        otp: $<HTMLInputElement>("otp").value,
      });
      $<HTMLInputElement>("otp").value = "";
      sessionStorage.removeItem("velocity-setup-email");
      await load();
    },
    true,
  );
});
$("resend-code").addEventListener("click", () => {
  void action(
    $("resend-code"),
    async () => {
      const result = await api("send-code", { email });
      $("login-message").textContent = result.message;
      $<HTMLInputElement>("otp").value = "";
      $("otp").focus();
    },
    true,
  );
});
$("change-email").addEventListener("click", () => {
  sessionStorage.removeItem("velocity-setup-email");
  $("code-form").hidden = true;
  $("email-form").hidden = false;
  $("email").focus();
});
$("sign-out").addEventListener("click", () => {
  if (dirty() && !confirm("Sign out and discard unsaved changes?")) return;
  void action($("sign-out"), async () => {
    await api("sign-out", {});
    content = null;
    saved = "";
    signedIn = false;
    $("workspace").hidden = true;
    $("toolbar").hidden = true;
    $("login").hidden = false;
    $("email-form").hidden = false;
    $("code-form").hidden = true;
    $("login-message").textContent = "You are signed out.";
  });
});
$("fields-form").addEventListener("submit", (event) => event.preventDefault());
$("page-picker").addEventListener("change", () => {
  page = $<HTMLSelectElement>("page-picker").value;
  group = page + ".hero";
  navigation();
  renderFields();
  $("preview-title").textContent =
    page === "home" ? "Home" : "Google Ads in Traralgon";
  $<HTMLIFrameElement>("page-preview").src = `/admin/preview/${page}`;
});
$("section-picker").addEventListener("change", () =>
  selectGroup($<HTMLSelectElement>("section-picker").value, true),
);
$("show-fields").addEventListener("click", () =>
  document.body.classList.add("fields-open"),
);
$("close-fields").addEventListener("click", () =>
  document.body.classList.remove("fields-open"),
);
for (const [id, width] of [
  ["desktop-view", 1280],
  ["mobile-view", 390],
] as const)
  $(id).addEventListener("click", () => {
    viewport = width;
    $("desktop-view").setAttribute("aria-pressed", String(width === 1280));
    $("mobile-view").setAttribute("aria-pressed", String(width === 390));
    sizePreview();
  });
window.addEventListener("message", (event) => {
  if (
    event.origin !== location.origin ||
    event.source !== $<HTMLIFrameElement>("page-preview").contentWindow
  )
    return;
  if (event.data?.type === "velocity-preview-ready") {
    tellPreview();
    focusPreview();
  }
  if (event.data?.type === "velocity-select")
    selectGroup(event.data.group, true);
});
$("save-button").addEventListener("click", async () => {
  if (busy || uploading || !dirty()) return;
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) {
    const key = parsed.error.issues[0].path[1];
    const field = fields.find((f) => f.key === key);
    if (field) {
      if (field.group.startsWith("home.") || field.group.startsWith("ads.")) {
        const targetPage = field.group.split(".")[0];
        if (page !== targetPage) {
          $<HTMLSelectElement>("page-picker").value = targetPage;
          $("page-picker").dispatchEvent(new Event("change"));
        }
      }
      selectGroup(field.group, true);
    }
    notice("Check the highlighted field before saving.");
    return;
  }
  busy = true;
  updateState();
  const requested = JSON.stringify(content);
  try {
    const result = await api("save", { content: parsed.data, version });
    acceptDraft(result, JSON.stringify(content) === requested);
    notice(
      dirty()
        ? "Draft saved. Your newer edits are still unsaved."
        : "Draft saved. The public website has not changed.",
    );
  } catch (e) {
    notice((e as Error).message);
  } finally {
    busy = false;
    updateState();
  }
});
$("download-draft").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "velocity-unsaved-draft.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("reload-draft").addEventListener("click", () => {
  if (
    dirty() &&
    !confirm(
      "Load the saved draft and discard your unsaved edits? Download them first if you need to keep a copy.",
    )
  )
    return;
  void action($("reload-draft"), async () => {
    acceptDraft(await api("draft"));
    notice("Loaded the latest saved draft.");
  });
});
async function loadHistory(append = false) {
  const result = await api(
    "history" +
      (append && historyCursor
        ? "&before=" + encodeURIComponent(historyCursor)
        : ""),
  );
  historyCursor = result.next;
  if (!append) $("history-list").replaceChildren();
  for (const row of result.items) {
    const item = document.createElement("li"),
      details = document.createElement("div"),
      title = document.createElement("strong"),
      meta = document.createElement("small"),
      button = document.createElement("button");
    title.textContent = new Date(row.created_at).toLocaleString();
    meta.textContent = `${row.kind === "restore" ? "Restored" : row.kind === "publish" ? "Publishing snapshot" : "Saved draft"} · ${row.author}`;
    details.append(title, meta);
    button.textContent = "Restore to draft";
    button.addEventListener("click", () => {
      if (
        !confirm(
          "Restore this version into your draft? Unsaved edits will be replaced; saved history stays intact.",
        )
      )
        return;
      void action(button, async () => {
        const result = await api("restore", { revisionId: row.id, version });
        acceptDraft(result);
        $<HTMLDialogElement>("history-dialog").close();
        notice(
          "Version restored into your draft. Review it before publishing.",
        );
      });
    });
    item.append(details, button);
    $("history-list").append(item);
  }
  $("more-history").hidden = !historyCursor;
  $("history-message").textContent = result.items.length
    ? ""
    : "No saved versions yet.";
}
$("history-button").addEventListener("click", () => {
  $<HTMLDialogElement>("history-dialog").showModal();
  $("history-message").textContent = "Loading…";
  void loadHistory().catch((e) => {
    $("history-message").textContent = e.message;
  });
});
$("close-history").addEventListener("click", () =>
  $<HTMLDialogElement>("history-dialog").close(),
);
$("more-history").addEventListener("click", () => {
  void action($("more-history"), () => loadHistory(true));
});
async function checkPublish() {
  if (!jobId) return;
  try {
    const job = await api(`publish-status&id=${encodeURIComponent(jobId)}`);
    publishing = ["preparing", "building", "unknown"].includes(job.status);
    $("publish-status").textContent =
      job.error ||
      (job.status === "ready"
        ? "Staging is up to date. Vercel confirmed the deployment."
        : publishing
          ? "Publishing to staging…"
          : "Publishing failed. Your draft is safe.");
    $("check-publish").hidden = !publishing;
    const link = $<HTMLAnchorElement>("deployment-link");
    link.hidden = job.status !== "ready" || !job.url;
    if (job.url) link.href = job.url;
    if (!publishing) publishKey = crypto.randomUUID();
    updateState();
  } catch (e) {
    $("publish-status").textContent = (e as Error).message;
    $("check-publish").hidden = false;
  }
}
$("publish-button").addEventListener("click", () => {
  if (dirty() || publishing || !publishReady) return;
  void action($("publish-button"), async () => {
    publishing = true;
    updateState();
    try {
      const job = await api("publish", { key: publishKey, version });
      jobId = job.id;
      await checkPublish();
    } catch (e) {
      publishing = false;
      throw e;
    }
  });
});
$("check-publish").addEventListener("click", () => {
  void action($("check-publish"), checkPublish);
});
window.addEventListener("beforeunload", (event) => {
  if (dirty() || uploading || busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
if (email) {
  $<HTMLInputElement>("email").value = email;
  $("email-form").hidden = true;
  $("code-form").hidden = false;
}
void load().catch((e) => {
  if (!signedIn) showLogin(e.message);
  else notice(e.message);
});
