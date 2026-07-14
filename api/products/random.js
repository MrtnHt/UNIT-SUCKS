// Vercel Edge Function → GET /api/products/random
export const config = { runtime: 'edge' };
import { handleProductsRandom } from '../../server/tasteMiddleware.js';
export default (request) => handleProductsRandom(request);
