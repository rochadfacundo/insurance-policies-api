
import axios from "axios";
import dotenv from "dotenv";

import { obtenerTokenMA } from "./login";

dotenv.config();

const BASE_URL = process.env.MA_BASE_URL!;
const SUBSCRIPTION_KEY = process.env.MA_SUBSCRIPTION_KEY!;

async function obtenerPolizasVigentes() {

    try {

        const token = await obtenerTokenMA();

        const productor = 13529;

        const response =
            await axios.get(`${BASE_URL}/cartera/v1/productores/${productor}/polizas/vigentes`,
                {
                    headers: {

                        Authorization: `Bearer ${token}`,

                        "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY
                    },

                    params: {
                        limit: 20,
                        offset: 0
                    }
                }
            );

        console.log(JSON.stringify(response.data,null,2));

    } catch (error: any) {

        console.error("STATUS:",error?.response?.status);

        console.error(error?.response?.data);
    }
}

obtenerPolizasVigentes();