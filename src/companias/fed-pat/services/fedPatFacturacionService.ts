import { EstadoRefacturacion } from "../../../models/estadoRefacturacion";
import { TipoProximaGestion } from "../../../models/tipoProximaGestion";
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

/**
 * Próximo evento de gestión de una póliza.
 *
 * La fecha se devuelve en formato YYYY-MM-DD,
 * o null cuando no puede determinarse.
 */
export interface FedPatProximaGestion {
    fecha: string | null;
    tipo: TipoProximaGestion | null;
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
    obtenerEndosoFacturacion(estado: FedPatPolizaState): FedPatCertificadoEndoso | null {

        const ultimoF = this.obtenerUltimoMovimiento(estado.endosos,"F");

        if (ultimoF !== null) {
            return ultimoF;
        }

        const ultimoR = this.obtenerUltimoMovimiento(estado.endosos,"R");

        if (ultimoR !== null) {
            return ultimoR;
        }

        return this.obtenerUltimoMovimiento(estado.endosos,"E");
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
    private obtenerUltimoMovimiento(endosos: FedPatCertificadoEndoso[],tipo: string): FedPatCertificadoEndoso | null {

        const movimientos = endosos.filter( endoso =>
                    endoso.certificado === 0 && this.normalizarTipo(endoso.tipo_endoso) === tipo);

        if (movimientos.length === 0) {
            return null;
        }

        return movimientos.reduce((ultimo, actual) =>
                actual.endoso > ultimo.endoso
                    ? actual
                    : ultimo);
    }

    /**
     * Normaliza el tipo de movimiento recibido desde la API.
     *
     * Algunos registros históricos pueden contener valores nulos
     * aunque el contrato TypeScript original los declare como string.
     * La validación en runtime evita que esos datos interrumpan
     * el procesamiento histórico.
     */
    private normalizarTipo(tipo: string | null | undefined): string {

        if (typeof tipo !== "string") {
            return "";
        }

        return tipo.trim().toUpperCase();
    }

   /**
     * Obtiene el estado y la próxima fecha de refacturación conocida
     * dentro de la vigencia contractual de una póliza.
     *
     * Modalidades con reglas validadas:
     *
     * - T/2: refacturación semestral de flotas.
     * - D/12: refacturación mensual individual.
     *
     * Para D/12 se utiliza la fecha de finalización del último
     * período de refacturación emitido (movimiento F).
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

        const tipoFacturacion = certificadoPrincipal.tipo_facturacion
                ?.trim()
                .toUpperCase() ?? "";

        const cantidadFacturacion = certificadoPrincipal.cant_facturacion;

        /*
        * REFACTURACIÓN MENSUAL D/12
        *
        * En las pólizas individuales con 12 períodos de facturación,
        * cada movimiento F representa una refacturación emitida.
        *
        * La fecha de emisión puede ser anterior al inicio del período.
        * Por eso, la próxima fecha de gestión se obtiene de
        * vigencia_hasta del último movimiento F del certificado principal.
        *
        * Caso validado:
        * Póliza 35331993
        * F/1 - Endoso 6
        * Emisión:       21/09/2026
        * Vigencia:      02/10/2026 al 02/11/2026
        * Próxima fecha: 02/11/2026
        */
        if (tipoFacturacion === "D" && cantidadFacturacion === 12) {

            const ultimoF = this.obtenerUltimoMovimiento(estado.endosos, "F");

            /*
            * No inferimos una fecha si no existe una refacturación
            * emitida o si el movimiento carece de vigencia_hasta.
            */
            if (ultimoF === null || !ultimoF.vigencia_hasta) {
                return {
                    fecha: null,
                    estado: EstadoRefacturacion.NO_DETERMINADA
                };
            }

            /*
            * Evitamos utilizar un período anterior si posteriormente
            * se registró una anulación en el certificado principal.
            *
            * Por seguridad, cualquier movimiento A posterior
            * requiere revisar el estado antes de inferir una fecha.
            */
            const existeAnulacionPosterior = estado.endosos.some(endoso =>
                    endoso.certificado === 0 && this.normalizarTipo(endoso.tipo_endoso) === "A" 
                    && endoso.endoso > ultimoF.endoso);

            if (existeAnulacionPosterior) {
                return {
                    fecha: null,
                    estado: EstadoRefacturacion.NO_DETERMINADA
                };
            }

            return {
                fecha: ultimoF.vigencia_hasta,
                estado: EstadoRefacturacion.PENDIENTE
            };
        }

        /*
        * Las modalidades distintas de T/2 y D/12 permanecen
        * sin una regla de cálculo validada.
        */
        if (tipoFacturacion !== "T" || cantidadFacturacion !== 2) {
            return {
                fecha: null,
                estado: EstadoRefacturacion.NO_DETERMINADA
            };
        }

        const endososCertificadoPrincipal = estado.endosos.filter(endoso => endoso.certificado === 0);

        /*
        * En los casos T/2 analizados, la existencia de F indica que
        * el segundo período de facturación ya fue emitido.
        *
        * Por lo tanto, no queda una nueva refacturación pendiente
        * dentro de la vigencia contractual actual.
        */
        const existeSegundoPeriodo = endososCertificadoPrincipal.some(endoso => 
            this.normalizarTipo(endoso.tipo_endoso) === "F");

        if (existeSegundoPeriodo) {
            return {
                fecha: null,
                estado: EstadoRefacturacion.SIN_REFAC_PENDIENTE
            };
        }

        const endosoFacturacion = this.obtenerEndosoFacturacion(estado);

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
                endoso.endoso > endosoFacturacion.endoso);

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


    /**
     * Determina la próxima gestión comercial conocida.
     *
     * Prioriza una refacturación pendiente y, cuando la
     * modalidad T/2 ya completó sus dos períodos,
     * utiliza el vencimiento contractual como renovación.
     *
     * Las modalidades no validadas no generan fechas inferidas.
     */
    obtenerProximaGestion(estado: FedPatPolizaState): FedPatProximaGestion {

        const certificadoPrincipal = estado.certificados.find(
            certificado => certificado.certificado === 0
        ) ?? null;

        if (certificadoPrincipal === null) {
            return { fecha: null, tipo: null };
        }

        const refacturacion = this.obtenerFechaProximaRefacturacion(estado);

        if (refacturacion.estado === EstadoRefacturacion.PENDIENTE && refacturacion.fecha !== null) {
            return {
                fecha: refacturacion.fecha,
                tipo: TipoProximaGestion.REFACTURACION
            };
        }

        const tipoFacturacion = certificadoPrincipal.tipo_facturacion?.trim().toUpperCase() ?? "";

        const cantidadFacturacion = certificadoPrincipal.cant_facturacion;

        /*
        * T/2: si el segundo período ya fue facturado,
        * la próxima gestión es la renovación anual.
        */
        if (tipoFacturacion === "T" && cantidadFacturacion === 2 &&
            refacturacion.estado === EstadoRefacturacion.SIN_REFAC_PENDIENTE &&
            certificadoPrincipal.vigencia_hasta) {
            return {
                fecha: certificadoPrincipal.vigencia_hasta,
                tipo: TipoProximaGestion.RENOVACION
            };
        }

        return { fecha: null, tipo: null };
    }

}