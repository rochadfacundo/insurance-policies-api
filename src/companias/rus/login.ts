import axios from "axios";

import {guardarToken, leerToken, tokenExpirado} from "../../utils/tokenUtils";

import { getRusConfig } from "./config";

export async function obtenerTokenRUS(forzarRenovacion = false): Promise<string> {

    const config = getRusConfig();

    const tokenKey =
        config.env === "prod"
            ? "rus-prod-organizador"
            : "rus-dev";

    const tokenGuardado = leerToken(tokenKey);

    const loginUrl = `${config.baseUrl}/login/token`;

    if (
        !forzarRenovacion &&
        tokenGuardado?.access_token &&
        !tokenExpirado(tokenGuardado.access_token)
    ) {
        return tokenGuardado.access_token;
    }

    console.log(
        `SOLICITANDO TOKEN RUS (${config.env})` +
        (forzarRenovacion ? " - renovación forzada" : "")
    );

    const response = await axios.post(
        loginUrl,
        {
            username: config.username,
            password: config.password
        },
        {
            headers: {
                "x-api-key": config.apiKey,
                "Content-Type": "application/json"
            }
        }
    );

    const accessToken = response.data?.access_token;

    if (!accessToken) {
        throw new Error(
            `RUS no devolvió access_token. Respuesta: ` +
            `${JSON.stringify(response.data)}`
        );
    }

    guardarToken(tokenKey, {
        access_token: accessToken,
        refresh_token: response.data?.refresh_token
    });

    return accessToken;
}