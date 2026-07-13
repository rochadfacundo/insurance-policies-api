import dotenv from "dotenv";
import path from "path";
import { RusConfig, RusEnv } from "./models/rusConfig";

dotenv.config({path: path.resolve(__dirname, "../../../.env")});

export function getRusConfig(): RusConfig {

    const envValue = process.env.RUS_ENV;

    const env: RusEnv = envValue === "dev" ? "dev" : "prod";

    const prefix = env === "dev" ? "RUS_DEV" : "RUS_PROD";

    const baseUrl = process.env[`${prefix}_BASE_URL`];

    const apiKey = process.env[`${prefix}_API_KEY`];

    const username = process.env[`${prefix}_USERNAME`];

    const password = process.env[`${prefix}_PASSWORD`];

    if (!baseUrl || !apiKey || !username || !password) {
        throw new Error(`Faltan variables de entorno para RUS_ENV=${env}`);
    }

    return {
        env,
        baseUrl: baseUrl.replace(/\/$/, ""),
        apiKey,
        username,
        password
    };
}