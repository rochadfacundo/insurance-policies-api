import { Poliza } from "../../../models/poliza";
import { ECompania } from "../../../models/eCompania";
import { TipoVigencia } from "../../../models/tipoVigencia";
import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatCertificadoSuma } from "../models/fedPatCertificadoSuma";
import { FedPatProductor } from "../models/fedPatProductor";
import { FedPatCliente } from "../models/fedPatCliente";
import { FedPatCertificado } from "../models/fetPatCertificado";

/**
 * Datos previamente seleccionados necesarios para construir
 * una póliza normalizada del sistema.
 *
 * Este contexto evita que FedPatPolizaMapper tenga que conocer
 * cómo se consultaron, agruparon o seleccionaron los movimientos
 * provenientes de los distintos endpoints de Federación Patronal.
 */
export interface FedPatPolizaMapperContext {
    certificado: FedPatCertificado;
    endoso: FedPatCertificadoEndoso | null;
    suma: FedPatCertificadoSuma | null;
    productor: FedPatProductor;
    cliente: FedPatCliente | null;
    cobertura: string | null;
}

/**
 * Mapper responsable de transformar la información ya consolidada
 * de Federación Patronal al modelo común `Poliza` utilizado por
 * el módulo de riesgos.
 *
 * Este mapper NO determina:
 * - cuál es el último movimiento de una póliza;
 * - qué certificado representa la cabecera;
 * - cuántos vehículos posee una póliza;
 * - qué riesgos deben asignarse.
 *
 * Esas decisiones pertenecen a la capa de procesamiento y al
 * RiskEngine respectivamente.
 */
export class FedPatPolizaMapper {

    /**
     * Convierte información consolidada de Federación Patronal
     * al modelo normalizado de póliza.
     */
    mapear(context: FedPatPolizaMapperContext): Poliza {

        const {
            certificado,
            endoso,
            suma,
            productor,
            cliente,
            cobertura
        } = context;

        const vigenciaDesde = new Date(certificado.vigencia_desde);

        const vigenciaHasta = new Date(certificado.vigencia_hasta);

        return {
            /*
             * La identidad se construye a nivel póliza y no a nivel
             * certificado. Los certificados pertenecientes a una misma
             * póliza deben converger en el mismo documento.
             */
            id: `FEDPAT_${certificado.numero_poliza}`,

            compania: ECompania.FEDERACION_PATRONAL,

            productor: {
                codigo: productor.codigo,
                nombre: productor.nombre
            },

            cliente: {
                nombre: cliente?.nombre ?? "SIN INFORMAR"
            },

            detallePoliza: {
                numeroPoliza: certificado.numero_poliza,

                /*
                 * El endoso se incluye únicamente cuando previamente
                 * se pudo determinar un movimiento representativo.
                 */
                ...(endoso !== null
                    ? { endoso: endoso.endoso }
                    : {})
            },

            riesgo: {
                /*
                 * Por el momento la cobertura se recibe ya resuelta.
                 * El mapper no intenta inferirla desde códigos internos
                 * de Federación.
                 */
                cobertura: cobertura ?? "SIN INFORMAR",

                /*
                 * certificados-sumas es la fuente agregada disponible
                 * para prima y premio a nivel certificado.
                 *
                 * Conservamos 0 cuando el endpoint no informa el valor,
                 * porque nuestro modelo común exige number.
                 */
                premio: suma?.premio ?? 0,
                prima: suma?.prima ?? 0
            },

            /*
             * Los riesgos de negocio se calculan posteriormente
             * mediante FedPatRiskEngine.
             */
            riesgos: [],

            facturacion: {
                /*
                 * Todavía no tenemos una fuente independiente de período
                 * de facturación en el modelo normalizado. Conservamos
                 * provisionalmente el período general del certificado.
                 */
                desde: vigenciaDesde,
                hasta: vigenciaHasta
            },

            vigencia: {
                desde: vigenciaDesde,
                hasta: vigenciaHasta,

                diasParaVencer: this.calcularDiasParaVencer(vigenciaHasta),

                tipo: this.obtenerTipoVigencia(vigenciaDesde, vigenciaHasta)
            }
        };
    }

    /**
     * Calcula los días restantes hasta el vencimiento.
     *
     * El cálculo se realiza utilizando milisegundos y redondeo hacia
     * arriba para conservar el día parcial como un día pendiente.
     */
    private calcularDiasParaVencer(fechaHasta: Date): number {

        const ahora = new Date();

        const diferencia = fechaHasta.getTime() - ahora.getTime();

        const milisegundosPorDia = 1000 * 60 * 60 * 24;

        return Math.ceil(diferencia / milisegundosPorDia);
    }

    /**
     * Clasifica la vigencia utilizando la duración aproximada
     * existente entre las fechas generales del certificado.
     *
     * Se utilizan rangos y no una cantidad exacta de días porque
     * meses y años calendario poseen distinta duración.
     */
    private obtenerTipoVigencia(desde: Date,hasta: Date): TipoVigencia {

        const diferencia = hasta.getTime() - desde.getTime();

        const dias = diferencia / (1000 * 60 * 60 * 24);

        if (dias >= 170 && dias <= 195) {
            return TipoVigencia.SEMESTRAL;
        }

        if (dias >= 350 && dias <= 380) {
            return TipoVigencia.ANUAL;
        }

        return TipoVigencia.OTRA;
    }
}