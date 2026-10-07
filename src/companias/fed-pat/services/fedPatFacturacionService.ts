import { EstadoRefacturacion } from "../../../models/estadoRefacturacion";
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

/**
 * Resultado del análisis de próxima refacturación.
 *
 * La fecha y el estado se devuelven juntos para distinguir entre:
 *
 * - una próxima refacturación conocida;
 * - una modalidad analizada sin otra refacturación pendiente;
 * - una modalidad cuya próxima refacturación todavía no puede
 *   determinarse con las reglas implementadas.
 */
export interface FedPatProximaRefacturacion {
    fecha: string | null;
    estado: EstadoRefacturacion;
}

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

   /**
     * Obtiene el estado y la próxima fecha de refacturación conocida
     * dentro de la vigencia contractual de una póliza.
     *
     * Actualmente la regla está validada únicamente para pólizas T/2.
     *
     * Para T/2:
     *
     * - si todavía no existe un movimiento F, el fin del período
     *   representativo actual puede considerarse la próxima refacturación;
     *
     * - si ya existe un movimiento F, el segundo período ya fue emitido
     *   y no queda otra refacturación pendiente dentro de la vigencia
     *   contractual actual.
     *
     * REGLA ESPECIAL VALIDADA:
     *
     * La combinación tipo_endoso = "A" y codigo_motivo_endoso = 219
     * corresponde, según el catálogo /cartera/motivos-endoso de
     * Federación Patronal, a:
     *
     * "NO PAGO DE PRIMA SEGÚN CG CO 10.1".
     *
     * Si este movimiento aparece posteriormente al movimiento inicial
     * utilizado como referencia, no debe inferirse una próxima
     * refacturación a partir de la vigencia_hasta de dicho movimiento.
     *
     * En ese escenario la próxima refacturación se considera
     * NO_DETERMINADA hasta contar con una regla de negocio más específica.
     *
     * Caso utilizado para validar esta regla:
     * póliza 34647213.
     *
     * Para modalidades todavía no analizadas se devuelve
     * NO_DETERMINADA, evitando interpretar ausencia de conocimiento
     * como ausencia real de una próxima refacturación.
     */
    obtenerFechaProximaRefacturacion(estado: FedPatPolizaState): FedPatProximaRefacturacion {

        const certificadoPrincipal = estado.certificados.find(
                certificado => certificado.certificado === 0
            ) ?? null;

        /*
        * Sin certificado principal no contamos con la información
        * necesaria para determinar la modalidad de facturación.
        */
        if (certificadoPrincipal === null) {
            return {
                fecha: null,
                estado: EstadoRefacturacion.NO_DETERMINADA
            };
        }

        const tipoFacturacion =
            certificadoPrincipal.tipo_facturacion
                ?.trim()
                .toUpperCase() ?? "";

        const cantidadFacturacion =
            certificadoPrincipal.cant_facturacion;

        /*
        * La regla implementada está validada exclusivamente para T/2.
        * Cualquier otra modalidad queda explícitamente como no determinada.
        */
        if (
            tipoFacturacion !== "T" ||
            cantidadFacturacion !== 2
        ) {
            return {
                fecha: null,
                estado: EstadoRefacturacion.NO_DETERMINADA
            };
        }

        const endososCertificadoPrincipal =
            estado.endosos.filter(
                endoso =>
                    endoso.certificado === 0
            );

        /*
        * En los casos T/2 analizados, la existencia de F indica que
        * el segundo período de facturación ya fue emitido.
        *
        * Por lo tanto, no queda una nueva refacturación pendiente
        * dentro de la vigencia contractual actual.
        */
        const existeSegundoPeriodo =
            endososCertificadoPrincipal.some(
                endoso =>
                    this.normalizarTipo(
                        endoso.tipo_endoso
                    ) === "F"
            );

        if (existeSegundoPeriodo) {
            return {
                fecha: null,
                estado:
                    EstadoRefacturacion.SIN_REFAC_PENDIENTE
            };
        }

        const endosoFacturacion =
            this.obtenerEndosoFacturacion(
                estado
            );

        /*
        * Si estamos ante una T/2 pero no conseguimos identificar
        * el movimiento representativo, no inferimos una fecha.
        */
        if (endosoFacturacion === null) {
            return {
                fecha: null,
                estado: EstadoRefacturacion.NO_DETERMINADA
            };
        }

        /*
        * La combinación A/219 corresponde, según el catálogo oficial
        * de motivos de endoso de Federación Patronal, a:
        *
        * "NO PAGO DE PRIMA SEGÚN CG CO 10.1".
        *
        * Solamente invalida nuestra inferencia cuando el movimiento
        * aparece después del endoso utilizado como referencia de
        * facturación. De esta forma evitamos aplicar la regla por la
        * sola presencia histórica de un A/219 anterior.
        */
        const existeNoPagoPosterior = endososCertificadoPrincipal.some(endoso =>
                this.normalizarTipo(endoso.tipo_endoso) === "A" &&
                endoso.codigo_motivo_endoso === 219 &&
                endoso.endoso > endosoFacturacion.endoso
        );

        if (existeNoPagoPosterior) {
        return {
            fecha: null,
            estado: EstadoRefacturacion.NO_DETERMINADA
        };
        }

        /*
        * Mientras todavía no exista F y no haya un movimiento A/219
        * posterior que invalide la inferencia, vigencia_hasta del
        * movimiento representativo marca la próxima instancia de
        * facturación según los casos T/2 observados.
        */
        return {
            fecha: endosoFacturacion.vigencia_hasta,
            estado: EstadoRefacturacion.PENDIENTE
        };
    }

}