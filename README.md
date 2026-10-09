[<img width="1200" alt="Transito" src="https://github.com/user-attachments/assets/f34b4d0e-964c-4d95-a882-d993bb7544f2" />](https://transito.tnitish.com)
## Transito's compainion server
This project provides a convenient wrapper around the LTA DataMall API, simplifying access to bus-related information. Built using Koa and TypeScript, it offers a more streamlined interface for common use cases.

The main reason for building this was that the raw LTA DataMall endpoints for bus stops, services, and routes can be a bit tricky to use, especially when you just want to grab specific details. This service grabs all the bus stop, service, and route data, gives it a good shake, and re-parses it into a data structure that's actually useful. 

Specifically, bus stop, service, and route data are retrieved, processed and then stored into two handy JSON files: `bus-services.json` and `bus-stops.json`. These files are the backbone of the server, providing the data for all your bus-related queries.

### But wait, won't the data become outdated?
That's a great question! Yes, bus information can change. That's why the data is refreshed every week. This refresh is handled by a cron job running on a Cloudflare Worker, ensuring the data stays reasonably up-to-date.

### Route Distance Index
After generating the JSON files, the server also publishes a compact route distance index (`route-distances/v1.json.gz`) to the project's Firebase Storage bucket, which the app uses to measure how far a bus is from a stop along its route. See [ADR-0002](docs/adr/0002-publish-route-distance-index-to-firebase-storage.md). The upload is skipped when the index hasn't changed, and a failed upload never fails JSON generation.

It uses Google application default credentials:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to a service account key that can write to the bucket. Not needed on the GCE VM, which uses its attached service account (it needs a Storage write role and the `devstorage.read_write` or `cloud-platform` scope). |
| `FIREBASE_STORAGE_EMULATOR_HOST` | Upload to the Firebase Storage emulator instead, e.g. `localhost:9199` for the emulator in the app repo. |

With `ENV=dev`, the upload only runs when `FIREBASE_STORAGE_EMULATOR_HOST` is set. Without credentials, the upload is skipped with a warning.

### Links
[Check out the main Transito repository](https://github.com/TechSupportz/transito-flutter)

[Download Transito today!](https://transito.tnitish.com)
