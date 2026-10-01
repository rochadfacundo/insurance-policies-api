import { FedPatPolizaState }
    from "../models/fedPatPolizaState";

import { FedPatDato }
    from "../models/fedPatDato";

import { FedPatTabla }
    from "../models/fedPatTabla";

import { TipoRiesgo }
    from "../../../models/TipoRiesgo";

import { FedPatPolizaConsolidationService }
    from "./fedPatPolizaConsolidationService";

import { FedPatProductoDatosMapper }
    from "../mappers/fedPatProductoDatosMapper";

import {
    FedPatVehiculo,
    FedPatVehiculoMapper
} from "../mappers/fedPatVehiculoMapper";

import { FedPatImportesService }
    from "./fedPatImportesService";
import { FedPatCertificadoEndoso } from "../models/fedPatCertificadoEndoso";


/**
 * Resultado del análisis de riesgos de una póliza de
 * Federación Patronal.
 *
 * Además de los riesgos detectados, se conservan los vehículos
 * identificados durante el análisis para facilitar pruebas,
 * diagnóstico y futuras reglas de negocio.
 */
export interface FedPatRiskAnalysis {

    /**
     * Riesgos detectados para la póliza luego de aplicar
     * todas las reglas de negocio configuradas.
     */
    riesgos: TipoRiesgo[];

    /**
     * Vehículos identificables reconstruidos a partir de los
     * certificados y productos-datos de la póliza.
     */
    vehiculos: FedPatVehiculo[];

    /**
     * Prima anual normalizada utilizada por el motor para evaluar
     * el riesgo PRIMA_ALTA.
     *
     * null indica que no fue posible determinar un importe anual
     * confiable con la información disponible.
     */
    primaAnual: number | null;

    /**
     * Premio anual normalizado utilizado por el motor para evaluar
     * el riesgo PREMIO_ALTO.
     *
     * null indica que no fue posible determinar un importe anual
     * confiable con la información disponible.
     */
    premioAnual: number | null;

        /**
     * Movimiento utilizado como fuente de facturación para calcular
     * los importes anualizados.
     *
     * Se conserva para que la póliza normalizada utilice el mismo
     * período de facturación que originó el análisis económico.
     */
    endosoFacturacion: FedPatCertificadoEndoso | null;
}


/**
 * Motor de reglas de riesgo para pólizas de Federación Patronal.
 *
 * Actualmente se evalúan tres riesgos independientes:
 *
 * - FLOTA:
 *   más de un vehículo distinto identificable dentro de una
 *   póliza perteneciente a un ramo vehicular soportado.
 *
 * - PRIMA_ALTA:
 *   prima anual calculada mayor o igual a $5.000.000.
 *
 * - PREMIO_ALTO:
 *   premio anual calculado mayor o igual a $7.000.000.
 *
 * Los importes anuales no se calculan dentro del RiskEngine.
 * Esa responsabilidad pertenece a FedPatImportesService.
 *
 * Si FedPatImportesService no dispone de evidencia suficiente
 * para anualizar un importe, retorna null y el riesgo económico
 * correspondiente no se asigna.
 */
export class FedPatRiskEngine {

    /**
     * Ramo 4: AUTOMOTORES.
     */
    private readonly RAMO_AUTOMOTORES = 4;

    /**
     * Ramo 44: MOTOVEHÍCULOS.
     */
    private readonly RAMO_MOTOVEHICULOS = 44;

    /**
     * Umbral anual utilizado para detectar PRIMA_ALTA.
     */
    private readonly PRIMA_ALTA_MINIMA = 5_000_000;

    /**
     * Umbral anual utilizado para detectar PREMIO_ALTO.
     */
    private readonly PREMIO_ALTO_MINIMO = 7_000_000;


    private readonly consolidationService =
        new FedPatPolizaConsolidationService();

    private readonly productoDatosMapper =
        new FedPatProductoDatosMapper();

    private readonly vehiculoMapper =
        new FedPatVehiculoMapper();

    private readonly importesService =
        new FedPatImportesService();


    /**
     * Analiza el estado acumulado conocido de una póliza.
     *
     * Las reglas económicas se evalúan para cualquier ramo.
     *
     * La reconstrucción de vehículos y la detección de FLOTA
     * solamente se realizan para los ramos vehiculares soportados.
     *
     * @param estado Estado reconstruido a partir de los feeds diarios.
     * @param datos Catálogo general /cartera/datos.
     * @param tablas Catálogo /cartera/tablas utilizado para traducir
     * valores codificados de productos-datos.
     */
    analizar(estado: FedPatPolizaState, datos: FedPatDato[],tablas: FedPatTabla[]): FedPatRiskAnalysis {

        const riesgos: TipoRiesgo[] = [];

        /*
         * Los importes anuales se calculan independientemente
         * del ramo de la póliza.
         *
         * FedPatImportesService devuelve null cuando no existe
         * evidencia suficiente para realizar una anualización
         * confiable.
         */
        const importes = this.importesService.calcularImportesAnuales(estado);


        /*
         * PRIMA_ALTA se determina exclusivamente sobre la
         * prima anual calculada.
         *
         * No utilizamos directamente la prima informada por
         * certificados-sumas porque observamos que puede
         * representar importes acumulados y no necesariamente
         * el costo anual de la póliza.
         */
        if (importes.primaAnual !== null && importes.primaAnual >= this.PRIMA_ALTA_MINIMA) {

            riesgos.push(TipoRiesgo.PRIMA_ALTA);
        }


        /*
         * PREMIO_ALTO se determina exclusivamente sobre el
         * premio anual calculado.
         *
         * El cálculo del premio anual y del factor utilizado
         * pertenece a FedPatImportesService.
         */
        if (importes.premioAnual !== null && importes.premioAnual >= this.PREMIO_ALTO_MINIMO) {

            riesgos.push(TipoRiesgo.PREMIO_ALTO);
        }


        /*
        * La lógica económica termina acá.
        *
        * Si el ramo no es vehicular no intentamos reconstruir
        * vehículos, pero conservamos los riesgos económicos y
        * los importes anuales calculados previamente.
        */
        if (!this.esRamoVehicular(estado.codigoRamo)) {

            /*
            * Conservamos también el movimiento de facturación utilizado
            * por FedPatImportesService.
            *
            * De esta manera el consumidor del análisis puede utilizar
            * exactamente el mismo endoso que originó los importes anuales.
            */
            return {
                riesgos,
                vehiculos: [],
                primaAnual: importes.primaAnual,
                premioAnual: importes.premioAnual,
                endosoFacturacion: importes.endosoFacturacion
            };
        }


        const vehiculos =
            this.obtenerVehiculos(
                estado,
                datos,
                tablas
            );


        /*
         * Una flota requiere más de un vehículo distinto
         * identificable dentro de la misma póliza.
         */
        if (vehiculos.length > 1) {

            riesgos.push(
                TipoRiesgo.FLOTA
            );
        }


        /*
        * El resultado expone tanto los riesgos detectados como los
        * valores y el movimiento que justificaron el análisis económico.
        */
        return {
            riesgos,
            vehiculos,
            primaAnual: importes.primaAnual,
            premioAnual: importes.premioAnual,
            endosoFacturacion: importes.endosoFacturacion
        };
    }


    /**
     * Determina si el ramo puede contener vehículos.
     *
     * No generalizamos esta lógica a otros ramos hasta contar
     * con evidencia suficiente sobre la estructura de sus
     * certificados y bienes asegurados.
     */
    private esRamoVehicular(
        codigoRamo: number
    ): boolean {

        return (
            codigoRamo === this.RAMO_AUTOMOTORES ||
            codigoRamo === this.RAMO_MOTOVEHICULOS
        );
    }


    /**
     * Reconstruye los vehículos conocidos de la póliza.
     *
     * Para cada certificado:
     *
     * 1. se obtiene su estado consolidado;
     * 2. se traducen sus productos-datos;
     * 3. se construye el vehículo;
     * 4. se descartan registros que no permiten identificar
     *    un bien asegurado;
     * 5. se eliminan vehículos duplicados.
     */
    private obtenerVehiculos(
        estado: FedPatPolizaState,
        datos: FedPatDato[],
        tablas: FedPatTabla[]
    ): FedPatVehiculo[] {

        const certificadosConsolidados =
            this.consolidationService.consolidar(
                estado
            );

        const vehiculos =
            new Map<string, FedPatVehiculo>();


        for (
            const consolidado
            of certificadosConsolidados
        ) {

            /*
             * Un certificado sin productos-datos no contiene
             * actualmente información suficiente para construir
             * un vehículo.
             *
             * Esto también evita asumir que certificado 0 siempre
             * es una cabecera: simplemente se ignora cuando no puede
             * identificarse un vehículo.
             */
            if (
                consolidado.productosDatos.length === 0
            ) {

                continue;
            }


            const datosMapeados =
                this.productoDatosMapper.mapear(
                    consolidado.productosDatos,
                    datos,
                    tablas
                );


            const vehiculo =
                this.vehiculoMapper.mapear(
                    datosMapeados
                );


            const claveVehiculo =
                this.obtenerClaveVehiculo(
                    vehiculo
                );


            /*
             * Si no existe patente ni chasis no tenemos una
             * identidad suficientemente confiable para contabilizar
             * el registro como un vehículo distinto.
             */
            if (!claveVehiculo) {

                continue;
            }


            /*
             * Map permite deduplicar un mismo vehículo si por alguna
             * particularidad del feed aparece asociado más de una vez.
             */
            vehiculos.set(
                claveVehiculo,
                vehiculo
            );
        }


        return Array.from(
            vehiculos.values()
        );
    }


    /**
     * Construye una identidad estable para un vehículo.
     *
     * Se prioriza el chasis porque identifica físicamente la unidad.
     * Si no está disponible, se utiliza la patente.
     *
     * Los valores se normalizan para evitar duplicados causados
     * únicamente por espacios o diferencias entre mayúsculas
     * y minúsculas.
     */
    private obtenerClaveVehiculo(
        vehiculo: FedPatVehiculo
    ): string | null {

        const chasis =
            this.normalizarIdentificador(
                vehiculo.chasis
            );


        if (chasis) {

            return `CHASIS:${chasis}`;
        }


        const patente =
            this.normalizarIdentificador(
                vehiculo.patente
            );


        if (patente) {

            return `PATENTE:${patente}`;
        }


        return null;
    }


    /**
     * Normaliza identificadores provenientes de la API.
     *
     * Federación puede devolver valores con espacios adicionales,
     * por lo que se eliminan antes de utilizarlos como identidad.
     */
    private normalizarIdentificador(
        valor: string | null
    ): string | null {

        if (!valor) {

            return null;
        }


        const normalizado =
            valor
                .trim()
                .toUpperCase();


        if (
            normalizado.length === 0 ||
            normalizado === "NULL"
        ) {

            return null;
        }


        return normalizado;
    }
}