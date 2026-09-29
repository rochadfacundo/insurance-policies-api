import { FedPatPolizaState }
    from "../models/fedPatPolizaState";

import { FedPatDato }
    from "../models/fedPatDato";

import { FedPatTabla }
    from "../models/fedPatTabla";


import { FedPatPolizaConsolidationService }
    from "./fedPatPolizaConsolidationService";

import { FedPatProductoDatosMapper }
    from "../mappers/fedPatProductoDatosMapper";

import {
    FedPatVehiculo,
    FedPatVehiculoMapper
} from "../mappers/fedPatVehiculoMapper";
import { TipoRiesgo } from "../../../models/TipoRiesgo";


/**
 * Resultado del análisis de riesgos de una póliza de
 * Federación Patronal.
 *
 * Además de los riesgos detectados, se conservan los vehículos
 * identificados durante el análisis para facilitar pruebas,
 * diagnóstico y futuras reglas de negocio.
 */
export interface FedPatRiskAnalysis {
    riesgos: TipoRiesgo[];
    vehiculos: FedPatVehiculo[];
}


/**
 * Motor de reglas de riesgo para pólizas de Federación Patronal.
 *
 * En esta primera implementación solamente se evalúa FLOTA.
 *
 * Una póliza se considera candidata a FLOTA cuando:
 *
 * - pertenece a un ramo vehicular soportado;
 * - se pueden reconstruir más de un vehículo distinto
 *   a partir de sus certificados y productos-datos.
 *
 * No se utiliza directamente la cantidad de certificados porque
 * algunos certificados pueden representar cabeceras o movimientos
 * administrativos y no necesariamente bienes asegurados.
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


    private readonly consolidationService =
        new FedPatPolizaConsolidationService();

    private readonly productoDatosMapper =
        new FedPatProductoDatosMapper();

    private readonly vehiculoMapper =
        new FedPatVehiculoMapper();


    /**
     * Analiza el estado acumulado conocido de una póliza.
     *
     * @param estado Estado reconstruido a partir de los feeds diarios.
     * @param datos Catálogo general /cartera/datos.
     * @param tablas Catálogo /cartera/tablas utilizado para traducir
     * valores codificados de productos-datos.
     */
    analizar(
        estado: FedPatPolizaState,
        datos: FedPatDato[],
        tablas: FedPatTabla[]
    ): FedPatRiskAnalysis {

        const riesgos: TipoRiesgo[] = [];

        /*
         * Por el momento solamente intentamos reconstruir vehículos
         * para ramos cuya naturaleza vehicular fue confirmada:
         *
         * 4  = AUTOMOTORES
         * 44 = MOTOVEHÍCULOS
         */
        if (!this.esRamoVehicular(estado.codigoRamo)) {

            return {
                riesgos,
                vehiculos: []
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


        return {
            riesgos,
            vehiculos
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