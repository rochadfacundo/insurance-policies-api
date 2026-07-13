import { RiesgoRUS } from "../src/companias/rus/models/riesgoRus";
import { TipoRiesgo } from "../src/models/TipoRiesgo";
import { obtenerProductoresRUS, obtenerProductoresRUS3 } from "../src/companias/rus/productoresRUS";
import { RusCarteraService } from "../src/companias/rus/services/rusCarteraService";

import { guardarJson } from "../src/utils/jsonUtils";
import { calcularDiasRestantes } from "../src/utils/utils";

const ARCHIVO_SALIDA = "rus-riesgos3.json";

async function main(): Promise<void> {
    try {
        const PREMIO_ALTO = 7_000_000;

        const productores = obtenerProductoresRUS3();

        const carteraService = new RusCarteraService();

        const resultadoFinal: RiesgoRUS[] = [];

        console.log("");
        console.log("========================================");
        console.log("RIESGOS RELEVANTES RUS");
        console.log("========================================");
        console.log("");

        for (const productor of productores) {
            console.log("");
            console.log("========================================");
            console.log(`${productor.nombre} (${productor.codigo})`);
            console.log("========================================");

            try {
                const cartera =
                    await carteraService.obtenerUltimoAnio(
                        productor.codigo
                    );

                console.log(
                    `Propuestas encontradas: ${cartera.getCantidad()}`
                );

                const riesgosDetectados: RiesgoRUS[] = [];

                for (const propuesta of cartera.getPropuestas()) {
                    try {
                        const emitida =
                            propuesta.estadoPoliza.trim() === "EMITIDA";

                        const vigente =
                            propuesta.vigenciaEstado.trim() === "VIGENTE";

                        if (!emitida || !vigente) {
                            continue;
                        }

                        const esFlota =
                            cartera.esFlota(propuesta);

                        const esPremioAlto =
                            propuesta.premio >= PREMIO_ALTO;

                        if (!esFlota && !esPremioAlto) {
                            continue;
                        }

                        const tipo =
                            esFlota
                                ? TipoRiesgo.FLOTA
                                : TipoRiesgo.PREMIO_ALTO;

                        const fechaRefacturacion =
                            propuesta.finPeriodoFacturacion ??
                            propuesta.finVigencia;

                        riesgosDetectados.push({
                            codigoProductor:
                                productor.codigo,

                            nombreProductor:
                                productor.nombre,

                            poliza:
                                propuesta.numeroPoliza,

                            asegurado:
                                propuesta.razonSocial.trim(),

                            patente:
                                propuesta.patente,

                            interesAsegurable:
                                propuesta.interesAsegurable,

                            cantidadVehiculos:
                                propuesta.cantidadVehiculos,

                            premio:
                                propuesta.premio,

                            cobertura:
                                propuesta.cobertura.trim(),

                            inicioVigencia:
                                propuesta.inicioVigencia,

                            finVigencia:
                                propuesta.finVigencia,

                            finPeriodoFacturacion:
                                fechaRefacturacion,

                            diasParaRefacturar:
                                calcularDiasRestantes(
                                    fechaRefacturacion
                                ),

                            tipo,

                            estadoPoliza:
                                propuesta.estadoPoliza.trim(),

                            vigenciaEstado:
                                propuesta.vigenciaEstado.trim(),

                            seccion:
                                propuesta.seccion,

                            numeroSeccion:
                                propuesta.numeroSeccion
                        });

                    } catch (error: any) {
                        console.error(
                            `Error analizando propuesta ${propuesta.propuesta}`
                        );

                        console.error(error?.message);
                    }
                }

                console.log("");
                console.log(
                    `Riesgos detectados: ${riesgosDetectados.length}`
                );

                resultadoFinal.push(...riesgosDetectados);

            } catch (error: any) {
                console.error(
                    `Error procesando productor ${productor.codigo}`
                );

                console.error(error?.message);
            }
        }

        console.log("");
        console.log("========================================");
        console.log("RESUMEN GENERAL");
        console.log("========================================");

        console.log(
            `Total oportunidades: ${resultadoFinal.length}`
        );

        console.log(
            `Flotas: ${
                resultadoFinal.filter(
                    riesgo => riesgo.tipo === TipoRiesgo.FLOTA
                ).length
            }`
        );

        console.log(
            `Premios altos: ${
                resultadoFinal.filter(
                    riesgo => riesgo.tipo === TipoRiesgo.PREMIO_ALTO
                ).length
            }`
        );

        resultadoFinal.sort(
            (a, b) =>
                a.diasParaRefacturar -
                b.diasParaRefacturar
        );

        console.log("");
        console.log("Exportando JSON...");

        guardarJson(
            resultadoFinal,
            ARCHIVO_SALIDA
        );

    } catch (error) {
        console.error("ERROR ANALIZANDO CARTERA RUS:");

        console.error(error);
    }
}

main();