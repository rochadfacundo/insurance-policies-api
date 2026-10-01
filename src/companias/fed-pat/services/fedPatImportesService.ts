import { FedPatPolizaState } from "../models/fedPatPolizaState";
import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";
import { FedPatCertificadoSuma } from "../models/fedPatCertificadoSuma";

/**
 * Resultado de la resolución de importes de una póliza.
 *
 * Además de los valores anualizados se conserva el movimiento
 * utilizado como fuente de facturación.
 *
 * Esto permite que la póliza normalizada muestre un período de
 * facturación consistente con el mismo movimiento utilizado para
 * calcular la prima anual.
 */
export interface FedPatImportesAnuales {
    primaAnual: number | null;
    premioAnual: number | null;
    endosoFacturacion: FedPatCertificadoEndoso | null;
}

/**
 * Fuente utilizada para obtener la prima periódica.
 *
 * F: movimiento de facturación/refacturación observado.
 * R: movimiento utilizado como fallback en pólizas D/2 sin F positivo.
 * E: movimiento utilizado como segundo fallback en pólizas D/2 sin F positivo.
 */
export type FedPatFuentePrima = "F" | "R" | "E";

/**
 * Resultado interno del cálculo de prima.
 *
 * Se conserva tanto el tipo de movimiento utilizado como el endoso
 * concreto que originó el importe periódico.
 */
interface FedPatPrimaCalculada {
    primaAnual: number;
    fuente: FedPatFuentePrima;
    endoso: FedPatCertificadoEndoso;
}

/**
 * Calcula importes anualizados a partir del estado acumulado de una póliza.
 *
 * IMPORTANTE:
 * Este servicio solamente calcula importes. No decide si una póliza
 * constituye un riesgo. La clasificación PRIMA_ALTA / PREMIO_ALTO
 * corresponde al FedPatRiskEngine.
 *
 * Reglas actualmente soportadas:
 *
 * D/12:
 *   último F positivo del certificado 0 × 12.
 *
 * D/3:
 *   último F positivo del certificado 0 × 3.
 *
 * D/2:
 *   último F positivo del certificado 0 × 2.
 *   Si no existe F positivo:
 *     R positivo × 2.
 *     Si tampoco existe R:
 *     E positivo × 2.
 *
 * El premio anual se estima utilizando exclusivamente la relación
 * premio/prima propia de la póliza:
 *
 *   factor = premioInformado / primaInformada
 *   premioAnual = primaAnual × factor
 *
 * Nunca se utiliza un factor promedio/global de otras pólizas.
 *
 * T/2 todavía no se procesa porque la muestra analizada es demasiado
 * pequeña para convertir el comportamiento observado en una regla productiva.
 */
export class FedPatImportesService {

    /**
     * Calcula prima y premio anualizados.
     */
    calcularImportesAnuales(estado: FedPatPolizaState): FedPatImportesAnuales {

        const certificadoPrincipal = estado.certificados.find(
                certificado => certificado.certificado === 0
            ) ?? null;

        if (certificadoPrincipal === null) {
            return this.sinImportes();
        }

        /*
        * La API histórica de Federación puede informar tipo_facturacion
        * como null aunque el contrato original lo modele como string.
        *
        * Sin tipo de facturación no existe evidencia suficiente para
        * anualizar la prima, por lo que la póliza queda sin importes
        * calculados en lugar de interrumpir el procesamiento completo.
        */
        if (!certificadoPrincipal.tipo_facturacion) {
            return this.sinImportes();
        }

        const tipoFacturacion =
            certificadoPrincipal.tipo_facturacion
                .trim()
                .toUpperCase();

        if (tipoFacturacion.length === 0) {
            return this.sinImportes();
        }

        const cantidadFacturacion = certificadoPrincipal.cant_facturacion;

        /*
         * Por ahora solamente procesamos facturación tipo D.
         *
         * T/2 queda deliberadamente excluido hasta disponer de una muestra
         * suficiente para validar su comportamiento.
         */
        if (tipoFacturacion !== "D") {
            return this.sinImportes();
        }

        if (cantidadFacturacion !== 2 && cantidadFacturacion !== 3 && cantidadFacturacion !== 12) {
            return this.sinImportes();
        }

        const primaCalculada = this.calcularPrimaTipoD(estado, cantidadFacturacion);

        if (primaCalculada === null) {
            return this.sinImportes();
        }

        const premioAnual = this.calcularPremioAnual(estado,primaCalculada.primaAnual);

        return {
            primaAnual: primaCalculada.primaAnual,
            premioAnual,
            endosoFacturacion: primaCalculada.endoso
        };
    }

    /**
     * Calcula la prima anual para pólizas con tipo de facturación D.
     *
     * Para D/12 y D/3 exigimos un F positivo.
     *
     * Para D/2 también aceptamos R o E como fallback porque el diagnóstico
     * histórico mostró que las pólizas sin F positivo quedan cubiertas
     * completamente por alguno de esos dos movimientos.
     */
    private calcularPrimaTipoD(estado: FedPatPolizaState,cantidadFacturacion: 2 | 3 | 12): FedPatPrimaCalculada | null {

        const endososCertificadoPrincipal = this.obtenerEndososCertificadoPrincipal(estado);

        const ultimoF = this.obtenerUltimoEndosoPositivoPorTipo(endososCertificadoPrincipal, "F");

        if (ultimoF !== null) {
            return {
                primaAnual: ultimoF.prima * cantidadFacturacion,
                fuente: "F",
                endoso: ultimoF
            };
        }

        /*
         * Los fallbacks R/E solamente fueron validados para D/2.
         * No deben aplicarse automáticamente a D/3 o D/12.
         */
        if (cantidadFacturacion !== 2) {
            return null;
        }

        const ultimoR = this.obtenerUltimoEndosoPositivoPorTipo(endososCertificadoPrincipal,"R");

        if (ultimoR !== null) {
            return {
                primaAnual: ultimoR.prima * 2,
                fuente: "R",
                endoso: ultimoR
            };
        }

        const ultimoE = this.obtenerUltimoEndosoPositivoPorTipo(endososCertificadoPrincipal,"E");

        if (ultimoE !== null) {
            return {
                primaAnual: ultimoE.prima * 2,
                fuente: "E",
                endoso: ultimoE
            };
        }

        return null;
    }

    /**
     * Devuelve solamente los movimientos correspondientes al certificado 0.
     *
     * El certificado 0 representa el nivel principal de la póliza utilizado
     * en los diagnósticos de facturación. No sumamos importes de certificados
     * individuales porque eso podría duplicar valores en pólizas colectivas.
     */
    private obtenerEndososCertificadoPrincipal(estado: FedPatPolizaState): FedPatCertificadoEndoso[] {

        return estado.endosos.filter(endoso => endoso.certificado === 0);
    }

    /**
     * Obtiene el movimiento positivo más reciente de un tipo determinado.
     *
     * Se utiliza el número de endoso para determinar cuál es el movimiento
     * más reciente. No dependemos del orden del array porque el estado de
     * FedPat se construye acumulando feeds diarios y ese orden no debe
     * considerarse una garantía de negocio.
     */
    private obtenerUltimoEndosoPositivoPorTipo(endosos: FedPatCertificadoEndoso[],tipo: FedPatFuentePrima)
    : FedPatCertificadoEndoso | null {

        const candidatos = endosos.filter(
                (endoso: FedPatCertificadoEndoso) => {

                    /*
                    * Algunos registros históricos pueden no informar tipo_endoso.
                    * Esos movimientos no pueden utilizarse como evidencia para
                    * seleccionar una fuente F/R/E y se descartan del cálculo.
                    */
                    if (!endoso.tipo_endoso) {
                        return false;
                    }

                    const tipoEndoso = endoso.tipo_endoso.trim().toUpperCase();

                    return (tipoEndoso === tipo && Number.isFinite(endoso.prima) && endoso.prima > 0);

                   
                }
            );

        if (candidatos.length === 0) {
            return null;
        }

        return candidatos.reduce<FedPatCertificadoEndoso | null>(
            (ultimo: FedPatCertificadoEndoso | null,actual: FedPatCertificadoEndoso) => {

                if (ultimo === null) {
                    return actual;
                }

                return actual.endoso > ultimo.endoso
                    ? actual
                    : ultimo;
            },
            null
        );
    }

    /**
     * Estima el premio anual utilizando exclusivamente la relación
     * premio/prima observada en la misma póliza.
     *
     * Ejemplo:
     *
     *   prima informada  = 1.000.000
     *   premio informado = 1.300.000
     *
     *   factor = 1.3
     *
     * Si la prima anual calculada es 2.000.000:
     *
     *   premio anual estimado = 2.000.000 × 1.3
     *
     * Si no existe una relación válida, devolvemos null. No usamos un
     * promedio global porque introduciría una estimación basada en otras
     * pólizas.
     */
    private calcularPremioAnual(estado: FedPatPolizaState, primaAnual: number): number | null {

        const sumaPrincipal = this.obtenerSumaCertificadoPrincipal(estado);

        if (sumaPrincipal === null) {
            return null;
        }

        const primaInformada = sumaPrincipal.prima;
        const premioInformado = sumaPrincipal.premio;

        if (
            primaInformada === null ||
            primaInformada === undefined ||
            premioInformado === null ||
            premioInformado === undefined
        ) {
            return null;
        }

        if (
            !Number.isFinite(primaInformada) ||
            !Number.isFinite(premioInformado) ||
            primaInformada <= 0 ||
            premioInformado <= 0
        ) {
            return null;
        }

        const factorPremioPrima = premioInformado / primaInformada;

        if (
            !Number.isFinite(factorPremioPrima) ||
            factorPremioPrima <= 0
        ) {
            return null;
        }

        return primaAnual * factorPremioPrima;
    }

    /**
     * Obtiene los importes informados correspondientes al certificado 0.
     *
     * No sumamos registros de otros certificados porque certificados-sumas
     * mostró comportamiento de importe acumulado/póliza y no de cuotas
     * independientes que deban sumarse.
     */
    private obtenerSumaCertificadoPrincipal(estado: FedPatPolizaState): FedPatCertificadoSuma | null {

        return estado.sumas.find(suma => suma.certificado === 0) ?? null;
    }

     /**
     * Representa explícitamente que la póliza no puede anualizarse
     * con las reglas actualmente validadas.
     *
     * Si no podemos determinar los importes tampoco afirmamos cuál
     * sería el movimiento representativo de facturación.
     */
    private sinImportes(): FedPatImportesAnuales {
        return {
            primaAnual: null,
            premioAnual: null,
            endosoFacturacion: null
        };
    }
}