import type { APIRoute } from 'astro';
import { handleEditor } from '../../lib/editor/handler.js';
export const ALL: APIRoute = ({ request }) => handleEditor(request, { ...process.env, ...import.meta.env });
