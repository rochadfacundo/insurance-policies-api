import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatMotivoEndoso } from "../models/fedPatMotivoEndoso";

/**
 * Servicio responsable de consultar el catálogo de motivos
 * de endoso de la API de Cartera de Federación Patronal.
 *
 * El catálogo permite interpretar los campos `tipo_endoso` y
 * `codigo_motivo_endoso` presentes en los movimientos obtenidos
 * desde el endpoint `certificados-endosos`.
 *
 * A diferencia de los endpoints operativos de Cartera, esta consulta
 * no requiere fecha ni tipo de productor y devuelve directamente
 * una colección de motivos.
 */
export class FedPatMotivosEndosoService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
       
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene el catálogo completo de motivos de endoso
     * definido por Federación Patronal.
     *
     * La combinación de `tpMotivos` y `codigo` identifica el motivo
     * que puede asociarse posteriormente con `tipo_endoso` y
     * `codigo_motivo_endoso` de un movimiento.
     *
     * Los registros se devuelven sin transformaciones para preservar
     * los códigos y descripciones originales informados por la API.
     *
     * @returns Catálogo de motivos de endoso.
     */
    async obtenerMotivosEndoso(): Promise<FedPatMotivoEndoso[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatMotivoEndoso[]>(
            `${this.baseUrl}/v1/cartera/motivos-endoso`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        return response.data;
    }
}