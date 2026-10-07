import { Poliza } from "../../../models/poliza";
import { ECompania } from "../../../models/eCompania";

import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatProductor } from "../models/fedPatProductor";
import { FedPatCliente } from "../models/fedPatCliente";
import { FedPatCertificado } from "../models/fetPatCertificado";
import { TipoRiesgo } from "../../../models/TipoRiesgo";
import { DateUtils } from "../../../utils/dateUtils";
import { EstadoRefacturacion } from "../../../models/estadoRefacturacion";


/**
 * Datos previamente seleccionados y calculados necesarios para construir
 * una póliza normalizada de Federación Patronal.
 *
 * El mapper recibe información ya consolidada para evitar que esta capa
 * tenga que interpretar feeds diarios, seleccionar movimientos, calcular
 * importes o ejecutar reglas de detección de riesgos.
 */
export interface FedPatPolizaMapperContext {

    /**
     * Certificado principal utilizado como cabecera de la póliza.
     *
     * Actualmente trabajamos con el certificado 0 como nivel principal
     * para la información general de la póliza.
     */
    certificado: FedPatCertificado;

    /**
     * Movimiento representativo utilizado para informar el período
     * de facturación.
     *
     * La selección de este movimiento debe realizarse antes de invocar
     * al mapper. El mapper no decide qué endoso es el correcto.
     */
    endoso: FedPatCertificadoEndoso | null;

    /**
     * Productor asociado al código informado en el certificado.
     */
    productor: FedPatProductor;

    /**
     * Cliente previamente relacionado con el asegurado de la póliza.
     *
     * Puede ser null cuando la información histórica disponible no
     * permite resolver el cliente.
     */
    cliente: FedPatCliente | null;

    /**
     * Descripción de cobertura previamente resuelta.
     *
     * El mapper no interpreta códigos internos de cobertura de FedPat.
     */
    cobertura: string | null;

    /**
     * Prima anual calculada por FedPatImportesService.
     *
     * null representa que no existe información suficiente para
     * anualizar el importe de forma confiable.
     */
    primaAnual: number | null;

    /**
     * Premio anual calculado a partir de la relación premio/prima
     * observada en la propia póliza.
     */
    premioAnual: number | null;

    /**
     * Riesgos de negocio ya determinados por FedPatRiskEngine.
     *
     * El mapper conserva exactamente los riesgos utilizados para
     * decidir la persistencia de la póliza.
     */
    riesgos: TipoRiesgo[];

    /**
     * Próxima fecha de refacturación previamente determinada por la
     * capa de dominio.
     *
     * null representa que no existe otra refacturación conocida dentro
     * de la vigencia contractual actual.
     */
    fechaProximaRefacturacion: string | null;

    /**
     * Estado resultante del análisis de próxima refacturación.
     *
     * Permite distinguir una fecha pendiente conocida, la ausencia
     * de otra refacturación dentro de la vigencia contractual y los
     * casos que todavía no pueden determinarse.
     */
    estadoRefacturacion: EstadoRefacturacion;
}

/**
 * Mapper responsable de transformar información ya consolidada de
 * Federación Patronal al modelo común `Poliza` utilizado por el sistema.
 *
 * Este mapper NO determina:
 *
 * - cuál es el certificado principal;
 * - cuál es el movimiento de facturación representativo;
 * - cuántos vehículos posee una póliza;
 * - cómo se anualizan prima y premio;
 * - qué riesgos corresponden a la póliza;
 * - cómo se resuelve una cobertura.
 *
 * Todas esas decisiones deben llegar previamente resueltas.
 */
export class FedPatPolizaMapper {

    /**
     * Convierte información consolidada de Federación Patronal
     * al modelo normalizado `Poliza`.
     *
     * @param context Información previamente seleccionada y calculada.
     * @returns Póliza normalizada lista para ser procesada por la capa
     *          de persistencia.
     */
    mapear(context: FedPatPolizaMapperContext): Poliza {

        const {
            certificado,
            endoso,
            productor,
            cliente,
            cobertura,
            primaAnual,
            premioAnual,
            riesgos,
            fechaProximaRefacturacion,
            estadoRefacturacion
        } = context;

        /*
         * Las fechas generales de vigencia pertenecen al certificado
         * principal y representan el período contractual de la póliza.
         */
        const vigenciaDesde = new Date(certificado.vigencia_desde);
        const vigenciaHasta = new Date(certificado.vigencia_hasta);

        /*
         * Cuando existe un movimiento representativo de facturación,
         * utilizamos su período.
         *
         * Si no existe, conservamos temporalmente la vigencia general
         * como fallback para mantener completo el modelo común.
         *
         * IMPORTANTE:
         * El mapper no selecciona qué endoso representa la facturación.
         * Esa decisión pertenece a la capa de procesamiento.
         */
        const facturacionDesde = endoso !== null
            ? new Date(endoso.vigencia_desde)
            : vigenciaDesde;

        const facturacionHasta = endoso !== null
            ? new Date(endoso.vigencia_hasta)
            : vigenciaHasta;

        return {

            /*
             * La identidad de Federación Patronal se construye utilizando
             * ramo + número de póliza.
             *
             * No utilizamos únicamente numero_poliza porque un mismo número
             * podría existir dentro de diferentes ramos.
             */
            id: `FEDPAT_${certificado.codigo_ramo}_${certificado.numero_poliza}`,

            compania: ECompania.FEDERACION_PATRONAL,

            productor: {
                codigo: productor.codigo,
                nombre: productor.nombre
            },

            /*
             * El cliente puede no encontrarse en los feeds históricos
             * disponibles. En ese caso conservamos explícitamente que
             * el nombre no pudo ser informado.
             */
            cliente: {
                nombre: cliente?.nombre ?? "SIN INFORMAR"
            },

            detallePoliza: {
                numeroPoliza: certificado.numero_poliza,

                /*
                 * El número de endoso solamente se persiste cuando
                 * previamente se pudo seleccionar un movimiento
                 * representativo.
                 */
                ...(endoso !== null
                    ? { endoso: endoso.endoso }
                    : {})
            },

            riesgo: {

                /*
                 * La cobertura debe llegar previamente resuelta.
                 * No inferimos descripciones desde códigos internos
                 * dentro de esta capa.
                 */
                cobertura: cobertura ?? "SIN INFORMAR",

                /*
                 * Los importes provienen del mismo cálculo anualizado
                 * utilizado por el RiskEngine para detectar PRIMA_ALTA
                 * y PREMIO_ALTO.
                 *
                 * De esta forma evitamos detectar un riesgo utilizando
                 * un importe anual y posteriormente mostrar en la UI un
                 * importe periódico diferente.
                 *
                 * El modelo común exige number, por lo que cuando no fue
                 * posible calcular el importe se conserva 0.
                 */
                premio: premioAnual ?? 0,
                prima: primaAnual ?? 0
            },

            /*
             * Los riesgos ya fueron determinados por FedPatRiskEngine.
             *
             * Creamos una nueva instancia del array para evitar compartir
             * accidentalmente una referencia mutable con el resultado
             * original del análisis.
             */
            riesgos: [...riesgos],

            /*
             * El período de facturación se obtiene del movimiento que
             * la capa de procesamiento haya seleccionado como
             * representativo.
             *
             * No debe confundirse con la vigencia contractual general.
             */
            facturacion: {
                desde: facturacionDesde,
                hasta: facturacionHasta
            },

            ...(fechaProximaRefacturacion !== null
                ? { fechaProximaRefacturacion: new Date(fechaProximaRefacturacion)}
                : {}
            ),
            /*
            * El estado se persiste siempre para Federación Patronal.
            *
            * Esto permite distinguir entre una póliza sin otra
            * refacturación pendiente y una cuya fecha todavía
            * no puede determinarse con las reglas disponibles.
            */
            estadoRefacturacion,
            /*
             * La vigencia corresponde al período contractual informado
             * por el certificado principal.
             */
            vigencia: {
                desde: vigenciaDesde,
                hasta: vigenciaHasta,

                /*
                * Los cálculos derivados de fechas se centralizan en DateUtils
                * para mantener un único criterio compartido entre compañías.
                */
                diasParaVencer: DateUtils.calcularDiasParaVencer(vigenciaHasta),
                tipo: DateUtils.calcularTipoVigencia(vigenciaDesde, vigenciaHasta)
            }
        };
    }


}