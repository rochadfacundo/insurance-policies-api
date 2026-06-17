

import axios from "axios";
import dotenv from "dotenv";
import path from "path";

import { obtenerTokenMA } from "./login";

dotenv.config({path: path.resolve(__dirname,"../.env")});

const BASE_URL = process.env.MA_BASE_URL!;

const SUBSCRIPTION_KEY = process.env.MA_SUBSCRIPTION_KEY!;

async function obtenerProductores() {

    try {

        const token = await obtenerTokenMA();

        const response =
            await axios.get(`${BASE_URL}/productores/v1`,
                {
                    headers: {

                        Authorization:
                            `Bearer ${token}`,

                        "Ocp-Apim-Subscription-Key":
                            SUBSCRIPTION_KEY
                    }

                    // opcional
                    // params: {
                    //     q: "86322"
                    // }
                }
            );

        console.log(JSON.stringify(response.data,null,2));

    } catch (error: any) {

        console.error("STATUS:",error?.response?.status);

        console.error(JSON.stringify(error?.response?.data,null,2));

    }

}

obtenerProductores();