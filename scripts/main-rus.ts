import { RiesgoRUS } from "../src/companias/rus/models/riesgoRus";
import { TipoRiesgo } from "../src/models/TipoRiesgo";
import { obtenerProductoresRUS } from "../src/companias/rus/productoresRUS";
import { RusCarteraService } from "../src/companias/rus/services/rusCarteraService";

import { guardarJson } from "../src/utils/jsonUtils";
import { calcularDiasRestantes } from "../src/utils/utils";

async function main() {

    try {

        const PREMIO_ALTO = 7_000_000;

        const productores = obtenerProductoresRUS();

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

                const cartera = await carteraService.obtenerUltimoAnio(productor.codigo);

                console.log(`Propuestas encontradas: ${cartera.getCantidad()}`);

                const riesgosDetectados: RiesgoRUS[] = [];

                for (const propuesta of cartera.getPropuestas()) {

                    try {

                        const emitida = propuesta.estadoPoliza.trim() === "EMITIDA";
                    
                        const vigente = propuesta.vigenciaEstado.trim() === "VIGENTE";
                    
                    if (!emitida || !vigente) {
                        continue;
                    }
                    
                    /*
                    if (propuesta.premio <= 0) {
                        continue;
                    }
                    */

                    const esFlota = cartera.esFlota(propuesta);

                    let esPremioAlto: boolean = false; 

                    const tipo: TipoRiesgo = esFlota ? TipoRiesgo.FLOTA : TipoRiesgo.PREMIO_ALTO;
    
                    if(tipo===TipoRiesgo.PREMIO_ALTO){
                        esPremioAlto = propuesta.premio >= PREMIO_ALTO;


                        if(!esPremioAlto){
                            continue;
                        }
                    }

                    

                    riesgosDetectados.push({

                        codigoProductor: productor.codigo,
                    
                        nombreProductor: productor.nombre,
                    
                        poliza: propuesta.numeroPoliza,
                    
                        asegurado: propuesta.razonSocial.trim(),
                    
                        patente: propuesta.patente,
                    
                        cantidadVehiculos: propuesta.cantidadVehiculos,
                    
                        interesAsegurable: propuesta.interesAsegurable,
                    
                        premio: propuesta.premio,
                    
                        cobertura: propuesta.cobertura.trim(),
                    
                        desde: propuesta.inicioVigencia,
                    
                        hasta: propuesta.finVigencia,
                    
                        diasParaVencer: calcularDiasRestantes(propuesta.finVigencia),

                        tipo,
                    
                        estadoPoliza: propuesta.estadoPoliza.trim(),
                    
                        vigenciaEstado: propuesta.vigenciaEstado.trim(),
                    
                        seccion: propuesta.seccion,
                    
                        numeroSeccion: propuesta.numeroSeccion
                    });

                    } catch (error: any) {

                        console.error(`Error analizando propuesta ${propuesta.propuesta}`);

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

                    console.log(`Premio: $${riesgo.premio.toLocaleString("es-AR")}`);

                    console.log(`Cobertura: ${riesgo.cobertura}`);

                    console.log(`Sección: ${riesgo.seccion}`);

                    console.log(`Vence: ${riesgo.hasta}`);

                    console.log(`Días para vencer: ${riesgo.diasParaVencer}`);
                }

            } catch (error: any) {

                console.error(`Error procesando productor ${productor.codigo}`);

                console.error(error?.message);
            }
        }

        console.log("");
        console.log("========================================");
        console.log("RESUMEN GENERAL");
        console.log("========================================");

        console.log(`Total oportunidades: ${resultadoFinal.length}`);

        //resultadoFinal.sort( (a, b) => a.diasParaVencer - b.diasParaVencer);
        resultadoFinal.sort((a, b) => b.premio - a.premio);

        console.log("");
        console.log("Exportando JSON...");

        guardarJson(resultadoFinal,"rus-riesgos3.json");

    } catch (error) {

        console.error("ERROR ANALIZANDO CARTERA RUS:");

        console.error(error);
    }
}

main();