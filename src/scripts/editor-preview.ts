import { contentSchema, format } from "../../lib/content/model.js";
const parentOrigin = location.origin;
function apply(content: any) {
  const page = location.pathname.split("/").filter(Boolean).at(-1);
  document.title = content.values[`${page}.seo.title`];
  for (const selector of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ])
    document
      .querySelector(selector)
      ?.setAttribute("content", content.values[`${page}.seo.description`]);
  for (const selector of [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ])
    document
      .querySelector(selector)
      ?.setAttribute("content", content.values[`${page}.seo.image`].src);
  for (const [selector, key, attribute, formatter] of [
    ["[data-content-text]", "contentText", "", "textFormat"],
    ["[data-content-href]", "contentHref", "href", "hrefFormat"],
    ["[data-content-label]", "contentLabel", "aria-label", "labelFormat"],
  ])
    document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      const value = content.values[node.dataset[key]!];
      if (typeof value !== "string") return;
      const text = format(value, node.dataset[formatter] || "");
      if (attribute) node.setAttribute(attribute, text);
      else node.textContent = text;
    });
  document
    .querySelectorAll<HTMLImageElement>("[data-content-image]")
    .forEach((img) => {
      const value = content.values[img.dataset.contentImage!];
      if (!value) return;
      if (img.getAttribute("src") !== value.src) img.src = value.src;
      img.alt = value.description;
      img.style.objectPosition = `${value.x}% ${value.y}%`;
      if (img.parentElement?.classList.contains("hero-art")) {
        img.style.aspectRatio = value.assetId ? "1" : "";
        img.style.objectFit = value.assetId ? "cover" : "";
      }
    });
}
const style = document.createElement("style");
style.textContent =
  "[data-editor-group]{position:relative;cursor:pointer;outline-offset:-3px} [data-editor-group]:hover,[data-editor-group]:focus-visible,[data-editor-group][data-selected]{outline:2px solid #c79bff!important} .reveal{opacity:1!important;transform:none!important} [data-editor-group]:focus-visible{outline-width:4px!important}";
document.head.append(style);
document
  .querySelectorAll<HTMLElement>("[data-editor-group]")
  .forEach((node) => {
    node.tabIndex = 0;
    node.setAttribute(
      "aria-label",
      `Edit ${node.dataset.editorGroup!.split(".").at(-1)}`,
    );
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        select(node.dataset.editorGroup!);
      }
    });
  });
function select(group: string) {
  window.parent.postMessage({ type: "velocity-select", group }, parentOrigin);
}
document.addEventListener(
  "click",
  (event) => {
    const target = event.target as HTMLElement;
    const group = target.closest<HTMLElement>("[data-editor-group]")?.dataset
      .editorGroup;
    if (target.closest("a,button") || group) event.preventDefault();
    if (group) select(group);
  },
  true,
);
document.addEventListener("submit", (event) => event.preventDefault(), true);
window.addEventListener("message", (event) => {
  if (event.origin !== parentOrigin || event.source !== window.parent) return;
  if (event.data?.type === "velocity-content") {
    const parsed = contentSchema.safeParse(event.data.content);
    if (parsed.success) apply(parsed.data);
  }
  if (
    event.data?.type === "velocity-focus" &&
    typeof event.data.group === "string"
  ) {
    document
      .querySelectorAll<HTMLElement>("[data-editor-group]")
      .forEach((node) => {
        const selected = node.dataset.editorGroup === event.data.group;
        node.toggleAttribute("data-selected", selected);
        if (selected && node.getBoundingClientRect().height)
          node.scrollIntoView({ behavior: "smooth", block: "center" });
      });
  }
});
window.parent.postMessage({ type: "velocity-preview-ready" }, parentOrigin);
