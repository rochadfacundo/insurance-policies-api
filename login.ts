import axios from "axios";
import dotenv from "dotenv";

import {
    guardarToken,
    leerToken,
    tokenExpirado
} from "./utils/tokenUtils"

dotenv.config();

const RUS_V2_BASE_URL = process.env.RUS_V2_BASE_URL!;
const RUS_V2_API_KEY = process.env.RUS_V2_API_KEY!;
const RUS_V2_USERNAME = process.env.RUS_V2_USERNAME!;
const RUS_V2_PASSWORD = process.env.RUS_V2_PASSWORD!;

export async function obtenerToken(): Promise<string> {

    const tokenGuardado = leerToken();

    if (
        tokenGuardado &&
        !tokenExpirado(tokenGuardado)
    ) {

        console.log("TOKEN CACHE");

        return tokenGuardado;
    }

    console.log("SOLICITANDO NUEVO TOKEN");

    const response = await axios.post(
        `${RUS_V2_BASE_URL}/v2/login/token`,
        {
            username: RUS_V2_USERNAME,
            password: RUS_V2_PASSWORD
        },
        {
            headers: {
                "x-api-key": RUS_V2_API_KEY,
                "Content-Type": "application/json"
            }
        }
    );

    const token = response.data.access_token;

    guardarToken(token);

    return token;
}