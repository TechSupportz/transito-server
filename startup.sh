#! /bin/bash

set -Eeuo pipefail

export DOCKER_CONFIG="/var/lib/transito-docker-config"
mkdir -p "$DOCKER_CONFIG"

docker-credential-gcr configure-docker --registries us-west1-docker.pkg.dev

IMAGE_URL="us-west1-docker.pkg.dev/transito-8f50c/transito-server/transito-server:latest"

docker pull "$IMAGE_URL"

docker stop transito-server || true
docker rm transito-server || true

docker stop cloudflared-tunnel || true
docker rm cloudflared-tunnel || true

# 4. FETCH SECRETS
LTA_API_KEY=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/LTA_API_KEY" -H "Metadata-Flavor: Google")

JSON_SECRET=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/JSON_SECRET" -H "Metadata-Flavor: Google")

ONEMAP_EMAIL=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/ONEMAP_EMAIL" -H "Metadata-Flavor: Google")

ONEMAP_PASSWORD=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/ONEMAP_PASSWORD" -H "Metadata-Flavor: Google")

CF_TOKEN=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/CF_TOKEN" -H "Metadata-Flavor: Google")

UNIVUS_APP_API=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/UNIVUS_APP_API" -H "Metadata-Flavor: Google")

UNIVUS_HTD_API=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/UNIVUS_HTD_API" -H "Metadata-Flavor: Google")

NUS_ETA_TOKEN=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/NUS_ETA_TOKEN" -H "Metadata-Flavor: Google")

# 5. START CF TUNNEL
docker run -d \
  --name cloudflared-tunnel \
  --restart always \
  --network host \
  cloudflare/cloudflared:latest tunnel --no-autoupdate run --token "$CF_TOKEN" 

# 6. START transito-server
docker run -d \
  --name transito-server \
  --restart always \
  --network host \
  -e LTA_API_KEY="$LTA_API_KEY" \
  -e SECRET="$JSON_SECRET" \
  -e ONEMAP_EMAIL="$ONEMAP_EMAIL" \
  -e ONEMAP_PASSWORD="$ONEMAP_PASSWORD" \
  -e UNIVUS_APP_API="$UNIVUS_APP_API" \
  -e UNIVUS_HTD_API="$UNIVUS_HTD_API" \
  -e NUS_ETA_TOKEN="$NUS_ETA_TOKEN" \
  -e PORT=80 \
  $IMAGE_URL

# 7. Run /generate-json function once transito-server is up
echo "Waiting for transito-server to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=1
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  RESPONSE=$(curl -s http://localhost:80/ 2>/dev/null)
  if echo "$RESPONSE" | grep -q "Transito's server is running as expected"; then
    echo "Service is ready!"
    break
  fi
  echo "Attempt $ATTEMPT/$MAX_ATTEMPTS - Service not ready yet, waiting..."
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
  echo "ERROR: Service failed to start after ${MAX_ATTEMPTS} attempts"
  exit 1
fi

curl -X POST http://localhost:80/generate-json --header "secret: $JSON_SECRET"
