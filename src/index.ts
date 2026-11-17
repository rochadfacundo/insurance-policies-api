import { onRequest } from "firebase-functions/v2/https";
import app from "./app";

export const apiCartera = onRequest(
    {
      region: 'us-central1',
      memory: '256MiB',
      maxInstances: 10,
      cors: [
        'http://localhost:4200'
      ]
    },
    app
  );
