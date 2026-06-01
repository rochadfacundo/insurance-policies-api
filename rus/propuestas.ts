
import axios from "axios";
import dotenv from "dotenv";
import { obtenerTokenRUS } from "./login";

dotenv.config();

const RUS_V2_BASE_URL = process.env.RUS_V2_BASE_URL!;
const RUS_V2_API_KEY = process.env.RUS_V2_API_KEY!;

async function obtenerPropuestas() {

    try {

        const token = await obtenerTokenRUS();
        console.log("TOKEN OBTENIDO");
        const response = await axios.post(`${RUS_V2_BASE_URL}/v2/propuestas/propuestas`,
            {
                codigoProductor: [7716],
                fechaEmision: "2025-12-12",
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

    } catch (error: any) {

        console.error("ERROR COMPLETO:");
        console.error(error);
    
        console.error("MESSAGE:");
        console.error(error?.message);
    
        console.error("STACK:");
        console.error(error?.stack);
    
        console.error( "ERROR STATUS:",error?.response?.status);
    }
}

obtenerPropuestas();