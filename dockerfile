FROM node:20-alpine AS base

RUN npm i -g pnpm@10.27.0

FROM base AS dependencies

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

FROM base AS build

WORKDIR /app
COPY . .

# Create empty JSON files
RUN echo '{ "metadata": "", "data": [] }' > ./src/json/bus-services.json
RUN echo '{ "metadata": "", "data": [] }' > ./src/json/bus-stops.json

COPY --from=dependencies /app/node_modules ./node_modules
RUN pnpm build
RUN pnpm prune --prod

FROM base AS deploy

WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/node_modules ./node_modules

EXPOSE 80

CMD [ "node", "dist/server.js" ]