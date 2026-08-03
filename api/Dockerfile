# ---- deps -------------------------------------------------------------------
# node:22-slim rather than alpine: sqlite3 is a native module, and on alpine npm has to
# build it from source, which means dragging a full node-gyp toolchain into the image for
# no benefit. Debian slim uses the prebuilt binding.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

# Set explicitly so the SAP secret guard in src/config/env.ts takes its production path:
# an unset NODE_ENV would refuse to start, which is exactly the behaviour we want to prove
# rather than only describe.
ENV NODE_ENV=production

# Reuse the already-compiled node_modules and drop dev dependencies from them, so the
# native sqlite3 binding isn't rebuilt a second time.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
RUN npm prune --omit=dev

COPY --from=build /app/dist ./dist
# Migrations and seeders are plain JS and ship as-is — they are run at startup, not built.
COPY .sequelizerc ./
COPY config ./config
COPY migrations ./migrations
COPY seeders ./seeders
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
