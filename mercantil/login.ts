
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import {
    guardarToken,
    leerToken,
    tokenExpirado
} from "../utils/tokenUtils";

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

console.log(
    "ENV PATH:",
    path.resolve(
        __dirname,
        "../.env"
    )
);

const BASE_URL =
    process.env.MA_BASE_URL!;

const USERNAME =
    process.env.MA_USERNAME!;

const PASSWORD =
    process.env.MA_PASSWORD!;

const SUBSCRIPTION_KEY =
    process.env.MA_SUBSCRIPTION_KEY!;

export async function obtenerTokenMA(): Promise<string> {

    const tokenGuardado =
        leerToken("mercantil");

    if (
        tokenGuardado?.access_token &&
        !tokenExpirado(
            tokenGuardado.access_token
        )
    ) {

        console.log(
            "TOKEN MERCANTIL CACHE"
        );

        return tokenGuardado.access_token;
    }

    console.log(
        "SOLICITANDO TOKEN MERCANTIL"
    );
    console.log("BASE_URL:", BASE_URL);
    console.log("USERNAME:", USERNAME);
    console.log("PASSWORD:", PASSWORD ? "OK" : "VACIO");
    console.log("SUBSCRIPTION_KEY:", SUBSCRIPTION_KEY ? "OK" : "VACIO");

    const body =
        new URLSearchParams();

    body.append(
        "client_id",
        "api-clientes-login"
    );

    body.append(
        "username",
        USERNAME
    );

    body.append(
        "password",
        PASSWORD
    );

    const response =
        await axios.post(
            `${BASE_URL}/credenciales/v2/`,
            body,
            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    "Ocp-Apim-Subscription-Key":
                        SUBSCRIPTION_KEY
                }
            }
        );

    guardarToken(
        "mercantil",
        {
            access_token:
                response.data.access_token,

            refresh_token:
                response.data.refresh_token
        }
    );

    return response.data.access_token;
}