export class EditorError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function insist(condition, status, message) {
  if (!condition) throw new EditorError(status, message);
}
