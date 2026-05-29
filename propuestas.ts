
import axios from "axios";
import dotenv from "dotenv";
import { obtenerToken } from "./login";

dotenv.config();

const RUS_V2_BASE_URL = process.env.RUS_V2_BASE_URL!;
const RUS_V2_API_KEY = process.env.RUS_V2_API_KEY!;

async function obtenerPropuestas() {

    try {

        const token = await obtenerToken();

        const response = await axios.post(
            `${RUS_V2_BASE_URL}/v2/propuestas/propuestas`,
            {
                codigoProductor: [8381],
                fechaEmision: "2025-11-13",
                pagina: 0
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "x-api-key": RUS_V2_API_KEY,
                    Accept: "application/json",
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("\nSTATUS:", response.status);

        console.log(
            JSON.stringify(response.data, null, 2)
        );

    } catch (error: any) {

        console.error(
            "ERROR STATUS:",
            error?.response?.status
        );

        console.error(
            "ERROR HEADERS:",
            error?.response?.headers
        );

        console.error(
            "ERROR DATA:",
            JSON.stringify(
                error?.response?.data,
                null,
                2
            )
        );
    }
}

obtenerPropuestas();