// Preloaded by `npm run dev` only. It declares "this is a development run", which is what
// lets src/config/env.ts fall back to the public development secret.
//
// Kept out of src/ deliberately: `npm start` runs dist/index.js with no preload, so a
// production process with an unset NODE_ENV fails fast instead of quietly accepting a
// publicly-known secret. Cross-platform, and no cross-env dependency.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
