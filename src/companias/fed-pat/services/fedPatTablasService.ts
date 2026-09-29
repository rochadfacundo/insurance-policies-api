import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatTabla } from "../models/fedPatTabla";
import { FedPatTablasResponse } from "../models/fedPatTablasResponse";

/**
 * Servicio responsable de consultar las tablas de valores
 * informadas por la API de Cartera de Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Estas tablas funcionan como catálogos auxiliares para interpretar
 * determinados valores codificados presentes en `producto_datos`.
 *
 * Este servicio únicamente obtiene la información. La relación entre
 * `codigo_dato`, `valor_dato` y las tablas correspondientes se resolverá
 * posteriormente en la capa de mapeo.
 */
export class FedPatTablasService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
      
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene las tablas de valores correspondientes a una fecha.
     *
     * La fecha debe utilizar el formato requerido por la API:
     * dd/MM/yyyy.
     *
     * Los registros se devuelven sin transformaciones para preservar
     * los códigos e índices originales informados por Federación.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Registros de tablas correspondientes a la fecha.
     */
    async obtenerTablas(fecha: string): Promise<FedPatTabla[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatTablasResponse>(
            `${this.baseUrl}/v1/cartera/tablas`,
            {
                params: {
                    fecha,
                    tipo: "O"
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        return response.data.tablas;
    }
}