import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { contentSchema, initialContent } from "./model.js";
const file = resolve(".generated/editor-content.json");
// Loaded once per build, never fetched by a visitor or from a moving draft.
export const buildContent = existsSync(file)
  ? contentSchema.parse(JSON.parse(readFileSync(file, "utf8")))
  : initialContent;

const revisionFile = resolve(".generated/editor-content-revision.json");
export const buildRevision = existsSync(revisionFile)
  ? JSON.parse(readFileSync(revisionFile, "utf8"))
  : null;
