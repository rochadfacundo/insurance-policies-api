import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatPolizaState } from "../models/fedPatPolizaState";

/**
 * Servicio encargado de resolver el movimiento que representa
 * el período de facturación de una póliza de Federación Patronal.
 *
 * Esta responsabilidad se mantiene separada del cálculo de importes:
 *
 * - FedPatImportesService determina prima y premio anualizados.
 * - FedPatFacturacionService determina el movimiento cuyo período
 *   debe utilizarse como referencia de facturación.
 *
 * Los feeds de Federación pueden contener movimientos posteriores
 * de novedad, emisión o anulación que no necesariamente representan
 * un nuevo período de facturación. Por ese motivo no se selecciona
 * simplemente el mayor número de endoso.
 */
export class FedPatFacturacionService {

    /**
     * Obtiene el movimiento representativo de facturación.
     *
     * Prioridad observada:
     *
     * 1. F: movimiento de facturación más reciente.
     * 2. R: movimiento inicial/renovación cuando todavía no existe F.
     * 3. E: movimiento de emisión cuando tampoco existe R.
     *
     * La selección se realiza sobre certificado 0 porque éste funciona
     * como cabecera de la póliza en nuestro modelo normalizado.
     *
     * Si no existe ningún movimiento compatible, se devuelve null.
     */
    obtenerEndosoFacturacion(
        estado: FedPatPolizaState
    ): FedPatCertificadoEndoso | null {

        const ultimoF =
            this.obtenerUltimoMovimiento(
                estado.endosos,
                "F"
            );

        if (ultimoF !== null) {
            return ultimoF;
        }

        const ultimoR =
            this.obtenerUltimoMovimiento(
                estado.endosos,
                "R"
            );

        if (ultimoR !== null) {
            return ultimoR;
        }

        return this.obtenerUltimoMovimiento(
            estado.endosos,
            "E"
        );
    }

    /**
     * Busca el movimiento más reciente de un tipo determinado
     * correspondiente al certificado principal.
     *
     * El orden se determina por número de endoso, que representa
     * la secuencia de movimientos dentro de la póliza.
     *
     * No se modifica el array original almacenado en el estado.
     */
    private obtenerUltimoMovimiento(
        endosos: FedPatCertificadoEndoso[],
        tipo: string
    ): FedPatCertificadoEndoso | null {

        const movimientos =
            endosos.filter(
                endoso =>
                    endoso.certificado === 0 &&
                    this.normalizarTipo(
                        endoso.tipo_endoso
                    ) === tipo
            );

        if (movimientos.length === 0) {
            return null;
        }

        return movimientos.reduce(
            (ultimo, actual) =>
                actual.endoso > ultimo.endoso
                    ? actual
                    : ultimo
        );
    }

    /**
     * Normaliza el tipo de movimiento recibido desde la API.
     *
     * Algunos registros históricos pueden contener valores nulos
     * aunque el contrato TypeScript original los declare como string.
     * La validación en runtime evita que esos datos interrumpan
     * el procesamiento histórico.
     */
    private normalizarTipo(
        tipo: string | null | undefined
    ): string {

        if (typeof tipo !== "string") {
            return "";
        }

        return tipo
            .trim()
            .toUpperCase();
    }
}