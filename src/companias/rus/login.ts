import axios from "axios";

import {guardarToken, leerToken, tokenExpirado } from "../../utils/tokenUtils";

import { getRusConfig } from "./config";

/**
 * Renovaciones actualmente en curso.
 *
 * La clave permite mantener locks independientes para:
 * - RUS producción
 * - RUS desarrollo
 */
const renovacionesEnCurso = new Map<string, Promise<string>>();

export async function obtenerTokenRUS(forzarRenovacion = false): Promise<string> {

    const config = getRusConfig();

    const tokenKey = config.env === "prod" ? "rus-prod-organizador" : "rus-dev";

    const tokenGuardado = leerToken(tokenKey);

    if (!forzarRenovacion && tokenGuardado?.access_token && !tokenExpirado(tokenGuardado.access_token)) {
        return tokenGuardado.access_token;
    }

    const renovacionExistente = renovacionesEnCurso.get(tokenKey);

    if (renovacionExistente) {
        console.log(`ESPERANDO RENOVACIÓN DE TOKEN RUS (${config.env})`);

        return renovacionExistente;
    }

    const loginUrl = `${config.baseUrl}/login/token`;

    const promesaRenovacion = (async (): Promise<string> => {

        console.log(`SOLICITANDO TOKEN RUS (${config.env})` +(forzarRenovacion ? " - renovación forzada" : ""));

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
            throw new Error(`RUS no devolvió access_token. Respuesta: ` +`${JSON.stringify(response.data)}`);
        }

        guardarToken(tokenKey, {access_token: accessToken,refresh_token:response.data?.refresh_token});

        return accessToken;

    })();

    renovacionesEnCurso.set(tokenKey, promesaRenovacion);

    try {
        return await promesaRenovacion;
    } finally {
        renovacionesEnCurso.delete(tokenKey);
    }
}