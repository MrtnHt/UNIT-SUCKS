// Vercel Edge Function → POST /api/taste
export const config = { runtime: 'edge' };
import { handleTaste } from '../server/tasteMiddleware.js';
export default (request) => handleTaste(request);
