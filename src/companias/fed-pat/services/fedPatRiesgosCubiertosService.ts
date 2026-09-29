import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatRiesgoCubierto }
    from "../models/fedPatRiesgoCubierto";
import { FedPatRiesgosCubiertosResponse }
    from "../models/fedPatRiesgosCubiertosResponse";

/**
 * Servicio responsable de consultar las coberturas asociadas
 * a los riesgos informados por la API de Cartera de
 * Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Cada registro se encuentra asociado a una combinación de ramo,
 * póliza, certificado y endoso, e identifica una cobertura mediante
 * `codigo_ramo_cobertura` y `codigo_cobertura`.
 *
 * Los valores económicos se mantienen exactamente como son
 * informados por la API. Pueden representar movimientos positivos
 * o negativos, por lo que no deben agregarse ni normalizarse en
 * esta capa.
 */
export class FedPatRiesgosCubiertosService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
       
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene las coberturas de riesgos informadas por Federación
     * Patronal para una fecha determinada.
     *
     * La fecha debe utilizar el formato requerido por la API:
     * dd/MM/yyyy.
     *
     * Los registros se devuelven sin filtros, agregaciones ni
     * transformaciones para preservar la información original
     * correspondiente a cada certificado y endoso.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Coberturas de riesgos correspondientes a la fecha.
     */
    async obtenerRiesgosCubiertos(fecha: string): Promise<FedPatRiesgoCubierto[]> {

        const token = await this.authService.getAccessToken();

        const response = await axios.get<FedPatRiesgosCubiertosResponse>(
                `${this.baseUrl}/v1/cartera/riesgos-cubiertos`,
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

        return response.data.riesgos_cubiertos;
    }
}