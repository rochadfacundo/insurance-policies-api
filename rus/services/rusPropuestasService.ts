import axios from "axios";
import { obtenerTokenRUS } from "../login";
import { getRusConfig } from "../config";

import {
    RusPropuestasRequest,
    RusPropuestasResponse
} from "../models/rusPropuestasInterfaces";

export async function obtenerPropuestas(body: RusPropuestasRequest): Promise<RusPropuestasResponse> {

    const config = getRusConfig();

    const token = await obtenerTokenRUS();

    const response =
        await axios.post<RusPropuestasResponse>(
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

        const url =
            `${config.baseUrl}/propuestas/propuestas/${numeroRamo}/${numeroPropuesta}/${numeroEndoso}/${numeroRenovacion}`;

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