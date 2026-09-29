import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatDato } from "../models/fedPatDato";

/**
 * Servicio responsable de consultar el catálogo de datos
 * de la API de Cartera de Federación Patronal.
 *
 * Este catálogo permite interpretar los códigos utilizados en
 * `producto_datos`. Por ejemplo, determinados códigos identifican
 * información como patente, chasis, fabricación, marca o modelo.
 *
 * A diferencia de los endpoints operativos de Cartera, este endpoint
 * no requiere fecha ni tipo de productor y devuelve directamente
 * una colección de registros.
 */
export class FedPatDatosService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
        
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene el catálogo completo de datos definido por
     * Federación Patronal.
     *
     * Cada registro contiene un código numérico y su descripción.
     * Estos códigos pueden utilizarse posteriormente para interpretar
     * los valores recibidos desde el endpoint `productos-datos`.
     *
     * @returns Catálogo de datos de Federación Patronal.
     */
    async obtenerDatos(): Promise<FedPatDato[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatDato[]>(
            `${this.baseUrl}/v1/cartera/datos`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        return response.data;
    }
}