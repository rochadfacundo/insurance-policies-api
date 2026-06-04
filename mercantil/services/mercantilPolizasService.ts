import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import { obtenerTokenMA } from "../login";

import {MercantilPolizasResponse} from "../models/mercantilModelPolizas";

dotenv.config({
    path: path.resolve(
        __dirname,
        "../../.env"
    )
});

const BASE_URL =
    process.env.MA_BASE_URL!;

const SUBSCRIPTION_KEY =
    process.env.MA_SUBSCRIPTION_KEY!;

export async function obtenerPolizasVigentes(
    productor: number,
    limit: number = 20,
    offset: number = 0
): Promise<MercantilPolizasResponse> {

    const token =
        await obtenerTokenMA();

    const response =
        await axios.get<MercantilPolizasResponse>(
            `${BASE_URL}/cartera/v1/productores/${productor}/polizas/vigentes`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`,

                    "Ocp-Apim-Subscription-Key":
                        SUBSCRIPTION_KEY
                },

                params: {
                    limit,
                    offset
                }
            }
        );

    return response.data;
}