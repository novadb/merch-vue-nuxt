# Nova Merchandising — Vue + Nuxt demo
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# .output holds the server and the client assets, with the server's dependencies (sharp's binary for this platform included)
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
# NOVA_DELIVERY_URL/USER/PASSWORD, DEMO_BRANCH, SHOPIFY_*, SITE_URL and MEDIA_CACHE_DIR come from the environment (the platform's secrets)
CMD ["node", ".output/server/index.mjs"]
