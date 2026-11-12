# Vendor Passport API / worker image. Build from the repository root:
#   docker build -f docker/api.Dockerfile -t vendor-passport-api .
# Run the API (default) or the worker:
#   docker run --env-file apps/api/.env -p 4000:4000 vendor-passport-api
#   docker run --env-file apps/api/.env vendor-passport-api node dist/worker.js

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/rules/package.json packages/rules/
COPY apps/api/package.json apps/api/
COPY fixtures/package.json fixtures/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund --workspace=@vp/shared --workspace=@vp/rules --workspace=@vp/api --include-workspace-root
COPY packages ./packages
COPY apps/api ./apps/api
COPY fixtures ./fixtures
RUN npm run build -w @vp/shared -w @vp/rules \
 && npx -w @vp/api prisma generate \
 && npm run build -w @vp/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/rules/package.json ./packages/rules/package.json
COPY --from=build /app/packages/rules/dist ./packages/rules/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/fixtures/extractions ./fixtures/extractions
WORKDIR /app/apps/api
ENV PORT=4000 FIXTURES_DIR=../../fixtures
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/api/v1/health || exit 1
# Applies pending migrations, then starts the API. Override CMD with `node dist/worker.js` for the worker.
ENTRYPOINT ["/bin/sh", "-c", "npx prisma migrate deploy && exec \"$@\"", "--"]
CMD ["node", "dist/main.js"]
