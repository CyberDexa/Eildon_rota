// Vercel serverless entry point — re-exports the Express app.
// Vercel sets VERCEL=1 which prevents app.listen() from being called in server/index.ts.
export { default } from '../server/index.js';
