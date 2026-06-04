import axios from "axios";
import { obtenerTokenRUS } from "../login";
import { getRusConfig } from "../config";

import {
    RusPropuestasRequest,
    RusPropuestasResponse
} from "../models/rusInterfaces";

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