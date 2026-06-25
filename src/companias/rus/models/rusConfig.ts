export type RusEnv =
    | "prod"
    | "dev";

export interface RusConfig {
    env: RusEnv;
    baseUrl: string;
    apiKey: string;
    username: string;
    password: string;
}