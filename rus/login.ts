
import axios from "axios";
import dotenv from "dotenv";

import {guardarToken,leerToken,tokenExpirado} from "../utils/tokenUtils";

dotenv.config();
import path from "path";

dotenv.config({path: path.resolve(__dirname, "../.env")});

const RUS_V2_BASE_URL = process.env.RUS_V2_BASE_URL!;
const RUS_V2_API_KEY = process.env.RUS_V2_API_KEY!;
const RUS_V2_USERNAME = process.env.RUS_V2_USERNAME!;
const RUS_V2_PASSWORD = process.env.RUS_V2_PASSWORD!;

export async function obtenerTokenRUS(): Promise<string> {

    const tokenGuardado = leerToken("rus");

    if (tokenGuardado?.access_token &&!tokenExpirado(tokenGuardado.access_token)) 
    {

        console.log("TOKEN RUS CACHE");

        return tokenGuardado.access_token;
    }

    console.log("SOLICITANDO TOKEN RUS");

    const response = await axios.post(`${RUS_V2_BASE_URL}/v2/login/token`,
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

    guardarToken("rus",
        {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token
        }
    );

    return response.data.access_token;
}