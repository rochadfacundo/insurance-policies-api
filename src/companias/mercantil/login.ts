
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import {guardarToken,leerToken,tokenExpirado } from "../../utils/tokenUtils";

dotenv.config({path: path.resolve(__dirname, "../../../.env") });

const BASE_URL = process.env.MA_BASE_URL!;

const USERNAME = process.env.MA_USERNAME!;

const PASSWORD = process.env.MA_PASSWORD!;

const SUBSCRIPTION_KEY = process.env.MA_SUBSCRIPTION_KEY!;


/**
 * Obtiene un token de acceso para la API de Mercantil Andina. 
 * Si ya existe un token guardado y no ha expirado, se devuelve ese token. 
 * De lo contrario, se solicita un nuevo token a la API y se guarda para su uso futuro. 
 * @returns Una promesa que se resuelve con el token de acceso obtenido. 
 */
export async function obtenerTokenMA(): Promise<string> {

    const tokenGuardado = leerToken("mercantil");

    if (tokenGuardado?.access_token &&!tokenExpirado(tokenGuardado.access_token))
    {
       // console.log("TOKEN MERCANTIL CACHE");

        return tokenGuardado.access_token;
    }

    //console.log("SOLICITANDO TOKEN MERCANTIL");


    const body = new URLSearchParams();

    body.append("client_id","api-clientes-login");

    body.append("username",USERNAME);

    body.append("password",PASSWORD);

    const response = await axios.post(`${BASE_URL}/credenciales/v2/`,
            body,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",

                    "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY
                }
            }
        );

    guardarToken("mercantil",{
            access_token: response.data.access_token,

            refresh_token: response.data.refresh_token
        });

    return response.data.access_token;
}