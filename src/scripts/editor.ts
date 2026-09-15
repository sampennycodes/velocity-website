import { fields, groups, contentSchema, contactEmailSettings } from "../../lib/content/model.js";
import { contactEmails, contactEmailVariables } from "../../lib/contact-email.js";
import { imageSource } from "../../lib/site.js";
import { publicationEstimate, publicationProgress } from "../../lib/editor/progress.js";
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
let canSave = false;
let stagingNeedsUpdate = false, checkingPublish = false;
let publishTimer: ReturnType<typeof setTimeout> | undefined;
let progressTimer: ReturnType<typeof setInterval> | undefined;
let progressJob: any = null;
let estimate = publicationEstimate();
function renderProgress() {
  const state = publicationProgress(progressJob, estimate);
  const title = $("publication-title");
  if (title.textContent !== state.title) title.textContent = state.title;
  $("publication-detail").textContent = state.detail;
  $("publication-elapsed").textContent = state.elapsed;
  $("publication-spinner").hidden = !state.active;
}
function showProgress(job: any = null) {
  progressJob = job;
  $("publication-progress").hidden = false;
  clearInterval(progressTimer);
  renderProgress();
  if (!job || !["ready", "failed"].includes(job.status))
    progressTimer = setInterval(renderProgress, 1000);
}
function hideProgress() {
  clearInterval(progressTimer);
  $("publication-progress").hidden = true;
}
const previewImages = new Map<string, string>();
let emailPreviewObservers: ResizeObserver[] = [];
const emailTypes = [
  {
    id: "contact-form",
    label: "Contact Form",
    fields: ["recipientEmail", "notificationSubject", "notificationMessage"],
    description: "The enquiry sent to your team. Replies go directly to the lead. Sender name and From email apply to both emails.",
  },
  {
    id: "autoresponder",
    label: "Autoresponder",
    fields: ["replyToEmail", "confirmationSubject", "confirmationMessage"],
    description: "The thank-you email sent to the lead. Sender name and From email apply to both emails.",
  },
];
let emailType = 0;
function clearPreviewImages() {
  for (const url of previewImages.values()) URL.revokeObjectURL(url);
  previewImages.clear();
}
let email = sessionStorage.getItem("velocity-setup-email") || "",
  viewport = 1280,
  jobId = "",
  publishKey = crypto.randomUUID(),
  historyCursor: string | null = null;
const dirty = () => content && (JSON.stringify(content) !== saved || previewImages.size > 0);
const notice = (text: string) => {
  $("notice").textContent = text;
};
function updateState() {
  $("save-state").textContent = !canSave
    ? "Preview only · changes are not saved"
    : uploading
    ? "Uploading…"
    : busy
      ? "Saving…"
      : publishing
        ? "Saved · updating staging…"
      : dirty()
        ? "Unsaved changes"
        : stagingNeedsUpdate ? "Saved · staging needs updating" : publishReady ? "Saved · staging is up to date" : "All changes saved";
  $<HTMLButtonElement>("save-button").disabled =
    !signedIn || !canSave || busy || uploading || publishing || (!dirty() && !stagingNeedsUpdate);
  $<HTMLButtonElement>("publish-button").disabled =
    !signedIn || !canSave || busy || uploading || publishing || dirty() || !publishReady;
  $("publish-button").hidden = !canSave || !publishReady || !stagingNeedsUpdate || publishing || Boolean(dirty());
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
      { type: "velocity-content", content, previewImages: Object.fromEntries(previewImages) },
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
  $("email-preview").style.setProperty("--email-width", `${Math.min(600, viewport)}px`);
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
  renderEmailPreview();
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
  const editingEmails = group === "shared.emails";
  const visibleEmailFields = new Set(["senderName", "senderEmail", ...emailTypes[emailType].fields].map((key) => `shared.emails.${key}`));
  $("panel-title").textContent = editingEmails ? emailTypes[emailType].label : selected.label;
  $("panel-scope").textContent =
    editingEmails ? "CONTACT EMAILS" : selected.page === "shared"
      ? "SHARED CONTENT"
      : page === "home"
        ? "HOME PAGE"
        : "GOOGLE ADS PAGE";
  $("panel-description").textContent = editingEmails ? emailTypes[emailType].description : selected.description || "";
  $("panel-note").textContent = group === "shared.emails"
    ? "The samples use Alex Smith as an example lead. Save & update staging keeps these settings with the website version. Email delivery starts when the approved V2 version goes live."
    : "Changes appear in the preview immediately. Save your draft when you’re ready.";
  const form = $("fields-form");
  form.replaceChildren();
  for (const f of fields.filter((f) => f.group === group && (!editingEmails || visibleEmailFields.has(f.key)))) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    const id = "field-" + f.key;
    label.htmlFor = id;
    label.textContent = f.label;
    wrap.append(label);
    const help = document.createElement("p");
    help.id = id + "-help";
    help.className = "fine";
    help.textContent = "help" in f ? String(f.help) : "";
    if (help.textContent) wrap.append(help);
    const error = document.createElement("small");
    error.id = id + "-error";
    error.setAttribute("role", "status");
    if (f.type === "image") {
      const img = document.createElement("img");
      img.className = "image-thumb";
      img.src = previewImages.get(f.key) || imageSource(content.values[f.key].src);
      img.alt = content.values[f.key].description;
      wrap.append(img);
      const file = document.createElement("input");
      file.type = "file";
      file.id = id;
      file.accept = "image/jpeg,image/png,image/webp";
      wrap.append(file);
      const helper = document.createElement("p");
      helper.className = "image-meta";
      helper.textContent = canSave
        ? "JPEG, PNG or WebP · up to 3 MB · private until published"
        : "JPEG, PNG or WebP · up to 3 MB · stays in this browser only";
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
      if (f.key === "shared.profile.image") {
        const roundingLabel = document.createElement("label");
        roundingLabel.htmlFor = id + "-rounding";
        roundingLabel.textContent = "Corner rounding";
        const range = document.createElement("input");
        range.type = "range";
        range.id = roundingLabel.htmlFor;
        range.min = "0";
        range.max = "50";
        range.step = "1";
        range.value = String(content.values[f.key].rounding ?? 0);
        const output = document.createElement("output");
        output.setAttribute("for", range.id);
        const hint = document.createElement("p");
        hint.className = "image-meta";
        hint.textContent = "Square corners → rounded corners → circle. Use the crop controls to position the photo.";
        const showRounding = () => {
          const amount = content.values[f.key].rounding;
          const text = amount === undefined ? "Original shape" : amount === 0 ? "Square corners" : amount === 50 ? "Circle" : amount + "%";
          output.textContent = text;
          range.setAttribute("aria-valuetext", text);
          img.style.borderRadius = amount === undefined ? "" : amount + "%";
          img.style.aspectRatio = amount === 50 ? "1" : "";
          img.style.height = amount === 50 ? "auto" : "";
          img.style.objectFit = amount === 50 ? "cover" : "";
          img.style.objectPosition = `${content.values[f.key].x}% ${content.values[f.key].y}%`;
        };
        range.addEventListener("input", () => {
          content.values[f.key].rounding = Number(range.value);
          showRounding();
          changed();
        });
        showRounding();
        wrap.append(roundingLabel, range, output, hint);
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
      file.addEventListener("change", async () => {
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
        if (!canSave) {
          // Local image previews never touch the upload API or saved content.
          file.disabled = true;
          uploading = true;
          updateState();
          try {
            if (!["image/jpeg", "image/png", "image/webp"].includes(upload.type))
              throw new Error("Choose a JPEG, PNG or WebP image.");
            const bitmap = await createImageBitmap(upload);
            const pixels = bitmap.width * bitmap.height;
            bitmap.close();
            if (pixels > 16000000) throw new Error("Choose an image up to 16 megapixels.");
            const previous = previewImages.get(f.key);
            const url = URL.createObjectURL(upload);
            previewImages.set(f.key, url);
            if (previous) URL.revokeObjectURL(previous);
            img.src = url;
            img.alt = alt.value;
            status.textContent = "Preview only. This image is not uploaded or saved.";
            changed();
          } catch (error) {
            status.textContent = (error as Error).message || "This image could not be previewed.";
          } finally {
            file.disabled = false;
            file.value = "";
            uploading = false;
            updateState();
          }
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
              ...(content.values[f.key].rounding === undefined ? {} : { rounding: content.values[f.key].rounding }),
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
      input.required = !("optional" in f && f.optional);
      input.setAttribute("aria-describedby", `${error.id}${help.textContent ? ` ${help.id}` : ""}`);
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
      if (editingEmails && /\.(notification|confirmation)(Subject|Message)$/.test(f.key)) {
        const variables = document.createElement("div");
        variables.className = "email-variables";
        variables.setAttribute("role", "group");
        variables.setAttribute("aria-label", `Insert a variable into ${f.label.toLowerCase()}`);
        const hint = document.createElement("p");
        hint.id = `${id}-variables`;
        hint.textContent = "Insert a variable at your cursor. It will use the lead’s details.";
        input.setAttribute("aria-describedby", `${input.getAttribute("aria-describedby")} ${hint.id}`);
        variables.append(hint);
        const buttons = document.createElement("div");
        buttons.className = "email-variable-buttons";
        // Keep the selection when a mouse or touch user chooses a variable.
        let selection: [number, number] = [input.value.length, input.value.length];
        const rememberSelection = () => {
          selection = [input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length];
        };
        for (const event of ["select", "input", "keyup", "click", "blur"])
          input.addEventListener(event, rememberSelection);
        for (const variable of contactEmailVariables) {
          const token = `{${variable.key}}`;
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", `Insert ${variable.label.toLowerCase()} ${token} into ${f.label.toLowerCase()}`);
          const code = document.createElement("code");
          code.textContent = token;
          const example = document.createElement("span");
          example.textContent = `${variable.label} → ${variable.example}`;
          button.append(code, example);
          button.addEventListener("click", () => {
            const [start, end] = selection;
            if (input.value.length - (end - start) + token.length > input.maxLength) {
              error.textContent = `Make room for ${token}; this field allows ${input.maxLength} characters.`;
              input.focus();
              return;
            }
            input.focus();
            input.setRangeText(token, start, end, "end");
            input.dispatchEvent(new Event("input", { bubbles: true }));
          });
          buttons.append(button);
        }
        variables.append(buttons);
        wrap.append(variables);
      }
    }
    error.textContent = fieldError(f.key);
    wrap.append(error);
    form.append(wrap);
  }
  renderEmailPreview();
}
function renderEmailPreview() {
  for (const observer of emailPreviewObservers) observer.disconnect();
  emailPreviewObservers = [];
  const preview = $("email-preview");
  preview.hidden = group !== "shared.emails";
  $("email-tabs").hidden = preview.hidden;
  preview.setAttribute("aria-labelledby", `email-tab-${emailTypes[emailType].id}`);
  emailTypes.forEach((type, index) => {
    const tab = $("email-tab-" + type.id);
    tab.setAttribute("aria-selected", String(index === emailType));
    tab.tabIndex = index === emailType ? 0 : -1;
  });
  $("preview-stage").hidden = !preview.hidden;
  $("preview-title").textContent = !preview.hidden ? "Contact emails" : page === "home" ? "Home" : "Google Ads in Traralgon";
  $("canvas-hint").textContent = !preview.hidden
    ? "An example enquiry. Switch to Mobile to check the narrower layout."
    : "Select a section in the preview or choose it from the list.";
  preview.replaceChildren();
  sizePreview();
  if (preview.hidden || !content) return;
  try {
    const emails = contactEmails({ name: "Alex Smith", email: "alex@example.com", phone: "0400 000 000", message: "I’d like to find out more about your services." }, contactEmailSettings(content));
    const email = emails[emailType];
    const card = document.createElement("section");
    card.className = "email-sample";
    const heading = document.createElement("h2");
    heading.textContent = `${emailTypes[emailType].label} preview`;
    const sample = document.createElement("pre");
    sample.textContent = `From: ${email.from}\nTo: ${email.to.join(", ")}\nReply to: ${email.replyTo || "From email (no override)"}\nSubject: ${email.subject}`;
    const frame = document.createElement("iframe");
    frame.title = emailType === 0 ? "Styled enquiry email" : "Styled lead confirmation";
    // Content is escaped by contactEmails; the preview also blocks scripts,
    // top navigation, forms and network resources. Same-origin permits sizing only.
    frame.sandbox.add("allow-same-origin");
    frame.srcdoc = email.html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`);
    frame.addEventListener("load", () => {
      const body = frame.contentDocument?.body;
      if (!body || !frame.isConnected) return;
      const fit = () => { frame.style.height = `${Math.ceil(body.getBoundingClientRect().height) + 2}px`; };
      const observer = new ResizeObserver(fit);
      observer.observe(body);
      emailPreviewObservers.push(observer);
      fit();
    }, { once: true });
    card.append(heading, sample, frame);
    preview.append(card);
  } catch {
    preview.textContent = "Check the email settings to see the preview.";
  }
}
function selectEmailType(index: number) {
  emailType = index;
  renderFields();
  $("email-preview").scrollTop = 0;
  $("properties").scrollTop = 0;
}
emailTypes.forEach((type, index) => {
  const tab = $("email-tab-" + type.id);
  tab.addEventListener("click", () => selectEmailType(index));
  tab.addEventListener("keydown", (event) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % emailTypes.length;
    else if (event.key === "ArrowLeft") next = (index + emailTypes.length - 1) % emailTypes.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = emailTypes.length - 1;
    else return;
    event.preventDefault();
    selectEmailType(next);
    $("email-tab-" + emailTypes[next].id).focus();
  });
});
function acceptDraft(data: any, replace = true) {
  version = data.version;
  saved = JSON.stringify(data.content);
  if (replace) {
    content = data.content;
    renderFields();
    tellPreview();
  }
  $("updated").textContent =
    data.updatedAt
      ? `Draft ${version} · saved ${new Date(data.updatedAt).toLocaleString()} by ${data.updatedBy}`
      : "Starting from the current website content.";
  $("conflict").hidden = true;
  updateState();
}
async function load() {
  const { session, draft, status } = await api("workspace");
  estimate = status.estimate || publicationEstimate(status.publications);
  canSave = session.canSave === true;
  signedIn = true;
  email = session.email;
  $("identity").textContent = session.email;
  $("login").hidden = true;
  $("workspace").hidden = false;
  $("toolbar").hidden = false;
  for (const id of ["save-button", "history-button", "publish-button"])
    $(id).hidden = !canSave;
  $("panel-note").textContent = canSave
    ? "Changes appear in the preview immediately. Save your draft when you’re ready."
    : "Preview only. Try any changes here; refreshing or signing out discards them.";
  if (!content) {
    acceptDraft(draft);
    navigation();
  }
  publishReady = status.publishingConfigured;
  stagingNeedsUpdate = publishReady && !status.stagingCurrent;
  $("save-button").textContent = publishReady ? "Save & update staging" : "Save draft";
  $("publish-button").textContent = "Retry staging update";
  if (canSave && publishReady) $("panel-note").textContent = "Changes appear here immediately. Save & update staging makes them visible on the staging website.";
  const active = status.publications.find((p: any) =>
    ["preparing", "building", "unknown"].includes(p.status),
  );
  publishing = Boolean(canSave && active);
  if (!publishing) hideProgress();
  if (canSave && active) {
    jobId = active.id;
    publishing = true;
    showProgress(active);
    void checkPublish();
  }
  $("publish-status").textContent = !canSave
    ? "Preview only · saving and publishing are disabled."
    : publishReady
    ? `Staging updates usually take ${estimate.minSeconds}–${estimate.maxSeconds} seconds.`
    : "Staging publishing is not connected yet. Draft editing is available.";
  notice(
    !canSave
      ? "Preview mode: try text, links and images. Changes stay in this tab and are discarded on refresh."
      : dirty()
      ? "You’re signed back in. Your unsaved edits are still here."
      : publishReady ? "Choose a section to edit, then Save & update staging." : "Choose a section to edit. Your saved draft is private until you publish.",
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
    clearTimeout(publishTimer);
    hideProgress();
    clearPreviewImages();
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
  if (!canSave || busy || uploading || publishing) return;
  if (!dirty()) {
    if (publishReady && stagingNeedsUpdate) void action($("save-button"), beginPublish);
    return;
  }
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
      if (field.group === "shared.emails") {
        const target = emailTypes.findIndex((type) => type.fields.some((key) => field.key === `shared.emails.${key}`));
        if (target !== -1) emailType = target;
      }
      selectGroup(field.group, true);
      $("field-" + field.key)?.focus();
    }
    notice("Check the highlighted field before saving.");
    return;
  }
  busy = true;
  if (publishReady) showProgress();
  updateState();
  const requested = JSON.stringify(content);
  try {
    const result = await api(publishReady ? "save-publish" : "save", { content: parsed.data, version, ...(publishReady ? { key: publishKey } : {}) });
    acceptDraft(publishReady ? result.draft : result, JSON.stringify(content) === requested);
    busy = false;
    if (publishReady) {
      stagingNeedsUpdate = true;
      if (result.publication) {
        jobId = result.publication.id;
        publishing = !["ready", "failed"].includes(result.publication.status);
        showProgress(result.publication);
        notice(dirty() ? "Saved changes are updating staging. Your newer edits are still unsaved." : "Saved. Updating the staging website…");
        void checkPublish();
      } else {
        hideProgress();
        notice(result.publishError || "Saved, but staging could not be updated. Retry the staging update.");
        publishKey = crypto.randomUUID();
      }
      return;
    }
    notice(
      dirty()
        ? "Draft saved. Your newer edits are still unsaved."
        : "Draft saved. The public website has not changed.",
    );
  } catch (e) {
    hideProgress();
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
      if (!canSave) return;
      if (
        !confirm(
          "Restore this version into your draft? Unsaved edits will be replaced; saved history stays intact.",
        )
      )
        return;
      void action(button, async () => {
        const result = await api("restore", { revisionId: row.id, version });
        acceptDraft(result);
        stagingNeedsUpdate = publishReady;
        $<HTMLDialogElement>("history-dialog").close();
        notice(
          "Version restored into your draft. Review it, then Save & update staging.",
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
  if (!canSave) return;
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
  if (!jobId || checkingPublish) return;
  checkingPublish = true;
  clearTimeout(publishTimer);
  try {
    const job = await api(`publish-status&id=${encodeURIComponent(jobId)}`);
    publishing = ["preparing", "building", "unknown"].includes(job.status);
    showProgress(job);
    if (job.status === "ready") {
      // Another editor may have saved a newer draft while this build ran.
      const latest = await api("status");
      stagingNeedsUpdate = !latest.stagingCurrent;
      notice(dirty() ? "Staging updated. Your newer edits are still unsaved." : stagingNeedsUpdate ? "Staging updated. A newer saved draft is waiting to be applied." : "Saved successfully. The staging website is up to date.");
    }
    if (job.status === "failed") {
      stagingNeedsUpdate = true;
      notice(job.error || "Your changes are saved, but staging could not be updated. Retry the update.");
    }
    $("publish-status").textContent =
      job.error ||
      (job.status === "ready"
        ? "Staging update confirmed."
        : publishing
          ? "Updating staging…"
          : "Staging update failed. Your saved changes are safe.");
    $("check-publish").hidden = !publishing;
    const link = $<HTMLAnchorElement>("deployment-link");
    link.hidden = job.status !== "ready" || !job.url;
    if (job.url) link.href = job.url;
    if (!publishing) publishKey = crypto.randomUUID();
    updateState();
  } catch (e) {
    $("publish-status").textContent = (e as Error).message;
    $("check-publish").hidden = false;
  } finally {
    checkingPublish = false;
    if (publishing && signedIn && canSave)
      publishTimer = setTimeout(() => void checkPublish(), 5000);
    updateState();
  }
}
async function beginPublish() {
  publishing = true;
  showProgress();
  updateState();
  try {
    const job = await api("publish", { key: publishKey, version });
    jobId = job.id;
    showProgress(job);
    await checkPublish();
  } catch (e) {
    publishing = false;
    hideProgress();
    throw e;
  }
}
$("publish-button").addEventListener("click", () => {
  if (!canSave || dirty() || publishing || !publishReady) return;
  void action($("publish-button"), beginPublish);
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
