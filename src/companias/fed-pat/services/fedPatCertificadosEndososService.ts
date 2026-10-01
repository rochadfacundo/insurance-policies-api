import axios from "axios";
import { FedPatAuthService } from "./fedPatAuthService";
import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatCertificadosEndososResponse }  from "../models/fedPatCertificadosEndososResponse";
import { FedPatHttpUtils } from "../utils/fedPatHttpUtils";

/**
 * Servicio responsable de consultar los movimientos de endoso
 * informados por la API de Cartera de Federación Patronal.
 *
 * La consulta se realiza por fecha y a nivel organizador (`tipo=O`).
 *
 * Cada registro representa un movimiento asociado a una combinación
 * de ramo, póliza, certificado y número de endoso.
 *
 * Este servicio únicamente obtiene los datos de la API. La interpretación
 * del movimiento y la selección del endoso relevante se realizará
 * posteriormente en las capas de mapeo y lógica de negocio.
 */
export class FedPatCertificadosEndososService {

    private readonly baseUrl: string;

    constructor(private readonly authService: FedPatAuthService) {
        
        this.baseUrl = process.env.FED_PAT_BASE_URL ?? "https://api.fedpat.com.ar";
    }

    /**
     * Obtiene los movimientos de endoso informados por Federación
     * Patronal para una fecha determinada.
     *
     * La consulta utiliza el mecanismo de retry compartido para tolerar
     * errores transitorios de transporte sin interrumpir inmediatamente
     * una reconstrucción histórica extensa.
     *
     * No se realizan filtros ni transformaciones sobre los registros
     * recibidos para conservar la información original de Federación.
     *
     * @param fecha Fecha de consulta en formato dd/MM/yyyy.
     * @returns Movimientos de endoso correspondientes a la fecha.
     */
    async obtenerEndosos(fecha: string): Promise<FedPatCertificadoEndoso[]> {

        const token = await this.authService.getAccessToken();

        /*
        * El retry envuelve únicamente la consulta HTTP.
        *
        * Ante un error transitorio como ECONNRESET se repite exactamente
        * la misma consulta de endosos para la misma fecha.
        */
        const response = await FedPatHttpUtils.ejecutarConRetry(
                () =>
                    axios.get<FedPatCertificadosEndososResponse>(
                        `${this.baseUrl}/v1/cartera/certificados-endosos`,
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

        return response.data.endosos;
    }
}