import axios from "axios";

import {guardarToken, leerToken, tokenExpirado} from "../../utils/tokenUtils";

import { getRusConfig } from "./config";

export async function obtenerTokenRUS(): Promise<string> {

    const config = getRusConfig();

    const tokenKey = `rus-${config.env}`;

    const tokenGuardado = leerToken(tokenKey);

    const loginUrl = `${config.baseUrl}/login/token`;

    if (tokenGuardado?.access_token && !tokenExpirado(tokenGuardado.access_token)) {
        return tokenGuardado.access_token;
    }

    console.log(`SOLICITANDO TOKEN RUS (${config.env})`);

    const response = await axios.post(loginUrl,
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

    guardarToken(tokenKey,
        {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token
        }
    );

    return response.data.access_token;
}