import axios from "axios";

import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatCertificado } from "../models/fetPatCertificado";
import { FedPatCertificadosResponse } from "../models/fedPatCertificadoResponse";
import { FedPatHttpUtils } from "../utils/fedPatHttpUtils";

/**
 * Servicio responsable de consultar los certificados informados
 * por la API de Cartera de Federación Patronal.
 *
 * El endpoint de certificados se consulta por fecha y a nivel
 * organizador (`tipo=O`).
 *
 * La respuesta debe interpretarse como información correspondiente
 * a la fecha consultada. Este servicio no determina por sí mismo
 * el estado completo de la cartera ni interpreta la ausencia de un
 * certificado como una baja.
 */
export class FedPatCertificadosService {

    private readonly baseUrl: string;

    constructor(
        private readonly authService: FedPatAuthService
    ) {
        this.baseUrl =   process.env.FED_PAT_BASE_URL ??  "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene los certificados informados por Federación Patronal
     * para una fecha determinada.
     *
     * La consulta utiliza el mecanismo de retry compartido para tolerar
     * errores transitorios de transporte, como ECONNRESET, sin interrumpir
     * inmediatamente una reconstrucción histórica extensa.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Certificados informados para la fecha solicitada.
     */
    async obtenerCertificados(fecha: string): Promise<FedPatCertificado[]> {

        const token = await this.authService.getAccessToken();

        /*
        * El retry envuelve únicamente la operación HTTP.
        *
        * Si Federación cierra transitoriamente la conexión, se repite
        * exactamente la misma consulta para la misma fecha.
        */
        const response = await FedPatHttpUtils.ejecutarConRetry(
                () =>
                    axios.get<FedPatCertificadosResponse>(
                        `${this.baseUrl}/v1/cartera/certificados`,
                        {
                            params: {
                                fecha,
                                tipo: "O"
                            },
                            headers: {
                                Authorization: `Bearer ${token}`
                            }
                        }
                    )
            );

        return response.data.certificados;
    }
}