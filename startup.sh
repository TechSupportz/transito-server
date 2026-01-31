#! /bin/bash

docker-credential-gcr configure-docker --registries us-west1-docker.pkg.dev

IMAGE_URL="us-west1-docker.pkg.dev/transito-8f50c/transito-server/transito-server:latest"

docker stop transito-server || true
docker rm transito-server || true

# 4. FETCH SECRETS
LTA_API_KEY=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/LTA_API_KEY" -H "Metadata-Flavor: Google")

JSON_SECRET=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/JSON_SECRET" -H "Metadata-Flavor: Google")

ONEMAP_EMAIL=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/ONEMAP_EMAIL" -H "Metadata-Flavor: Google")

ONEMAP_PASSWORD=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/ONEMAP_PASSWORD" -H "Metadata-Flavor: Google")

CF_TOKEN=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/CF_TOKEN" -H "Metadata-Flavor: Google")

# 5. RUN THE SERVER
docker run -d \
  --name transito-server \
  --restart always \
  --network host \
  -e LTA_API_KEY="$LTA_API_KEY" \
  -e SECRET="$JSON_SECRET" \
  -e ONEMAP_EMAIL="$ONEMAP_EMAIL" \
  -e ONEMAP_PASSWORD="$ONEMAP_PASSWORD" \
  -e PORT=80 \
  $IMAGE_URL

# 6. START CF TUNNEL
docker run -d --network host cloudflare/cloudflared:latest tunnel --no-autoupdate run --token "$CF_TOKEN" 
