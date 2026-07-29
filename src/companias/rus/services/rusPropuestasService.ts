import axios from "axios";
import { obtenerTokenRUS } from "../login";
import { getRusConfig } from "../config";

import {
    RusPropuestasRequest,
    RusPropuestasResponse
} from "../models/rusPropuestasInterfaces";

/*
    * Obtiene las propuestas de un productor desde RUS.
    *
    * Si el token almacenado es rechazado, solicita uno nuevo y reintenta.
*/
export async function obtenerPropuestas(body: RusPropuestasRequest): Promise<RusPropuestasResponse> {

    const config = getRusConfig();

    const realizarConsulta = async (token: string): Promise<RusPropuestasResponse> => {

        const response = await axios.post(
            `${config.baseUrl}/propuestas/propuestas`,
            body,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "x-api-key": config.apiKey,
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data;
    };

    let token = await obtenerTokenRUS();

    let data = await realizarConsulta(token);

    if (esRespuestaNoAutorizada(data)) {

        console.warn(
            "RUS rechazó el token almacenado. Solicitando uno nuevo..."
        );

        token = await obtenerTokenRUS(true);

        data = await realizarConsulta(token);
    }

    if (esRespuestaNoAutorizada(data)) {
        throw new Error(
            `RUS rechazó también el token renovado. ` +
            `Respuesta: ${JSON.stringify(data)}`
        );
    }

    return data;
}

/*
    * Detecta si la respuesta de RUS indica que el token es inválido o expirado.
*/
function esRespuestaNoAutorizada(data: unknown): boolean {

    if (!data || typeof data !== "object") {
        return false;
    }

    const respuesta = data as {
        status?: number;
        error?: string;
    };

    return (
        respuesta.status === 401 ||
        respuesta.error?.toLowerCase() === "unauthorized"
    );
}

export async function obtenerDetallePropuesta(
    numeroRamo: number,
    numeroPropuesta: number,
    numeroEndoso: number,
    numeroRenovacion: number
): Promise<any> {

    try {

        const config = getRusConfig();

        const token = await obtenerTokenRUS();

        const url = `${config.baseUrl}/propuestas/propuestas/${numeroRamo}/${numeroPropuesta}/${numeroEndoso}/${numeroRenovacion}`;

        console.log("CONSULTANDO DETALLE:");
        console.log(url);

        const response =
            await axios.get(
                url,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "x-api-key": config.apiKey,
                        Accept: "application/json"
                    }
                }
            );

        return response.data;

    } catch (error: any) {

        console.error("=================================");
        console.error("ERROR DETALLE PROPUESTA RUS");
        console.error("=================================");

        console.error(
            "STATUS:",
            error?.response?.status
        );

        console.error(
            "DATA:",
            JSON.stringify(
                error?.response?.data,
                null,
                2
            )
        );

        console.error(
            "HEADERS:",
            JSON.stringify(
                error?.response?.headers,
                null,
                2
            )
        );

        console.error(
            "MESSAGE:",
            error?.message
        );

        throw error;
    }
}