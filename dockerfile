FROM node:25-alpine AS base

RUN npm i -g pnpm@11.5.0

FROM base AS dependencies

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

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

CMD [ "node", "-r", "module-alias/register", "dist/server.js" ]
