import { obtenerProductoresMercantil } from "../src/companias/mercantil/models/productoresMercantil";
import { RiesgoMercantil } from "../src/companias/mercantil/models/riesgoMercantil";
import { MercantilCarteraService } from "../src/companias/mercantil/services/mercantilCarteraService";
import { TipoRiesgo } from "../src/models/TipoRiesgo";
import { guardarJson } from "../src/utils/jsonUtils";
import { calcularDiasRestantes } from "../src/utils/utils";


async function main(): Promise<void> {

    try {

        const productores = obtenerProductoresMercantil();

        const carteraService = new MercantilCarteraService();

        console.log("");
        console.log("========================================");
        console.log("RIESGOS RELEVANTES MERCANTIL");
        console.log("========================================");
        console.log("");

        const resultadoFinal: RiesgoMercantil[] = [];

        for (const productor of productores) {

            console.log("");
            console.log("========================================");
            console.log(`${productor.nombre} (${productor.codigo})`);
            console.log("========================================");

            try {

                const cartera = await carteraService.obtenerCarteraCompleta(productor.codigo);

                console.log(`Pólizas encontradas: ${cartera.getCantidad()}`);

                const riesgosDetectados: RiesgoMercantil[] = [];

                for (const poliza of cartera.getPolizas()) {

                    try {

                        const bienes = await carteraService.obtenerBienesPoliza(poliza.poliza, poliza.endoso);

                        const detalle = await carteraService.obtenerDetallePoliza(poliza.poliza, poliza.endoso);

                        const esFlota = cartera.esFlota(poliza);

                        const prima = detalle.getPrima();

                        const esPrimaAlta = prima >= 5_000_000;

                        if (!esFlota && !esPrimaAlta) {
                            continue;
                        }

                        riesgosDetectados.push({

                            codigoProductor: productor.codigo,

                            nombreProductor: productor.nombre,

                            tipo: esFlota? TipoRiesgo.FLOTA : TipoRiesgo.PRIMA_ALTA,

                            poliza: poliza.poliza,

                            asegurado: poliza.nombreAsegurado,

                            bien: poliza.bienAsegurado,

                            cantidadBienes: bienes.getCantidadBienes(),

                            prima,

                            cobertura:detalle.getCobertura(),

                            // Inicio real de vigencia
                            desde:poliza.desde,

                            // Próxima refacturación
                            hasta:poliza.hasta,

                            // Fin real de póliza
                            finPoliza:poliza.finPoliza,

                            // Se calcula contra la refacturación
                            diasParaRefacturar:calcularDiasRestantes(poliza.hasta)
                        });

                    } catch (error: any) {

                        console.error(`Error analizando póliza ${poliza.poliza}`);

                        console.error(error?.message);
                    }
                }

                console.log("");
                console.log(`Riesgos detectados: ${riesgosDetectados.length}`);

                resultadoFinal.push(...riesgosDetectados);

                for (const riesgo of riesgosDetectados) {

                    console.log("");
                    console.log("--------------------------------");

                    console.log(`Póliza: ${riesgo.poliza}`);

                    console.log(`Asegurado: ${riesgo.asegurado}`);

                    console.log(`Bien: ${riesgo.bien}`);

                    console.log(`Cobertura: ${riesgo.cobertura}`);

                    console.log(`Cantidad bienes: ${riesgo.cantidadBienes}`);

                    console.log(`Flota: ${riesgo.tipo === TipoRiesgo.FLOTA ? "SI" : "NO"}`);

                    console.log(`Prima: $${riesgo.prima.toLocaleString("es-AR")}`);

                    console.log(`Inicio vigencia: ${riesgo.desde}`);

                    console.log(`Fin vigencia: ${riesgo.finPoliza}`);

                    console.log(`Próxima refacturación: ${riesgo.hasta}`);

                    console.log(`Días para refacturar: ${riesgo.diasParaRefacturar}`);
                }

            } catch (error: any) {

                console.error(`Error procesando productor ${productor.codigo}`);

                console.error("Mensaje:", error?.message);
            
                console.error("Base URL:",error?.config?.baseURL);
            
                console.error("URL relativa:",error?.config?.url);
            
                console.error("URL completa:",`${error?.config?.baseURL ?? ""}${error?.config?.url ?? ""}`);
            
                console.error("Código:",error?.code);
            
                console.error("Stack:",error?.stack);
            }
        }

        console.log("");
        console.log("========================================");
        console.log("RESUMEN GENERAL");
        console.log("========================================");

        console.log(`Total oportunidades: ${resultadoFinal.length}`);

        console.log(`Flotas: ${
                resultadoFinal.filter(
                    riesgo => riesgo.tipo === TipoRiesgo.FLOTA
                ).length
            }`);

        console.log(`Primas altas: ${resultadoFinal.filter(
                    riesgo => riesgo.tipo === TipoRiesgo.PRIMA_ALTA
                ).length}`);

        resultadoFinal.sort((a, b) => a.diasParaRefacturar - b.diasParaRefacturar);

        guardarJson(resultadoFinal,"mercantil-riesgos.json");

    } catch (error) {

        console.error("ERROR ANALIZANDO CARTERA:");

        console.error(error);
    }
}

main();