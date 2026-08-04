# Jobkeepr MCP server (stdio).
#
# Starts with or without JOBKEEPR_API_KEY: without one it comes up, answers
# introspection, and reports the missing credential through the protocol rather
# than exiting. That keeps a misconfigured client from looking like a crash loop
# and lets registries inspect the server without secrets.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist

# stdio transport: the client speaks JSON-RPC over stdin/stdout.
ENTRYPOINT ["node", "dist/index.js"]
