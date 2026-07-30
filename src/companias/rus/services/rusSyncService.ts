import { Poliza } from "../../../models/poliza";
import { Productor } from "../../../models/productor";
import { formatearDuracion } from "../../../utils/utils";
import { RusPolizaMapper } from "../mapper/rusPolizaMapper";
import { ModoSincronizacionRus } from "../models/modoSincronizacionRus";
import { RusPropuesta } from "../models/rusPropuestasInterfaces";
import { RusCarteraService } from "./rusCarteraService";
import { RusRiskEngine } from "./rusRiskEngine";

export interface ResultadoRusSync {

    propuestasConsultadas: number;
    propuestasVigentes: number;
    riesgosDetectados: number;
    polizas: Poliza[];
}

export class RusSyncService {

    constructor(
        private readonly carteraService: RusCarteraService = new RusCarteraService()
    ) {}

    /**
     * Reconstruye la cartera del productor dentro de un rango,
     * detecta riesgos y los transforma al modelo general Poliza.
     *
     * Este método todavía no escribe en Firestore.
     */
    async sincronizar(productor: Productor, fechaDesde: string,fechaHasta: string,modo: ModoSincronizacionRus): Promise<ResultadoRusSync> {


        //debug trazo
        const inicioSincronizacion = Date.now();

        console.log("--------------------------------------------------");
        console.log(`Productor: ${productor.codigo} - ${productor.nombre}`);
        console.log(`Modo: ${modo}`);
        console.log(`Desde: ${fechaDesde}`);
        console.log(`Hasta: ${fechaHasta}`);
        console.log("--------------------------------------------------");



        //debug trazo
        const inicioObtencionCartera = Date.now();

        const manager = await this.carteraService.obtenerCarteraPorRango(productor.codigo,fechaDesde,fechaHasta);

        //debug trazo2
        const duracionObtencionCartera = Date.now() - inicioObtencionCartera;

        const propuestasConsultadas = manager.getPropuestas();

        //debug trazo3
        console.log("");
        console.log("MÉTRICAS DE OBTENCIÓN DE CARTERA");
        console.log({
            duracion: formatearDuracion(duracionObtencionCartera),
            propuestasObtenidas: propuestasConsultadas.length
        });

        //debug trazo4
        const inicioFiltradoVigentes = Date.now();

        const propuestasVigentes = propuestasConsultadas.filter(propuesta => this.esPropuestaVigente(propuesta));

        //debug trazo5
        const duracionFiltradoVigentes = Date.now() - inicioFiltradoVigentes;


        //debug trazo6
        const inicioDiagnostico = Date.now();


        //debug premios
        const propuestasConPremioMayor = [...propuestasVigentes]
                .sort((a, b) => Number(b.premio ?? 0) - Number(a.premio ?? 0)).slice(0, 10);

        const posiblesFlotas = propuestasVigentes.filter(propuesta =>
                    propuesta.numeroSeccion === 4 ||
                    propuesta.esFlota === true ||
                    Number(propuesta.cantidadVehiculos ?? 0) > 1);

        console.log("");
        console.log("==================================================");
        console.log("DIAGNÓSTICO DE RIESGOS RUS");
        console.log("==================================================");


        //debug trazo6.5
        if (propuestasVigentes.length === 0) {
            console.log("No hay propuestas vigentes para diagnosticar.");
        } else {
            console.log("Premio máximo:", {
                premio: propuestasConPremioMayor[0]?.premio ?? 0,
                poliza: propuestasConPremioMayor[0]?.numeroPoliza,
                cliente:propuestasConPremioMayor[0]?.nombrePersona?.trim() || propuestasConPremioMayor[0]?.razonSocial?.trim()
            });
        
            console.table(propuestasConPremioMayor.map(propuesta => ({
                    poliza: propuesta.numeroPoliza,
                    cliente: propuesta.nombrePersona?.trim() || propuesta.razonSocial?.trim(),
                    seccion: propuesta.numeroSeccion,
                    premio: propuesta.premio,
                    esFlota: propuesta.esFlota,
                    cantidadVehiculos: propuesta.cantidadVehiculos
            })));
        }

        console.log(`Posibles flotas encontradas: ${posiblesFlotas.length}`);

        if (posiblesFlotas.length > 0) {
            console.table(
                posiblesFlotas.map(
                    propuesta => ({
                        poliza: propuesta.numeroPoliza,
                        seccion: propuesta.numeroSeccion,
                        descripcionSeccion: propuesta.seccion,
                        esFlota: propuesta.esFlota,
                        cantidadVehiculos: propuesta.cantidadVehiculos,
                        premio: propuesta.premio
                    })
                )
            );
        }

        //fin debug


        //debug trazo7
        const duracionDiagnostico = Date.now() - inicioDiagnostico;
        const inicioDeteccionRiesgos = Date.now();

        const polizasRiesgosas: Poliza[] = [];

        for (const propuesta of propuestasVigentes) {

            const riesgos = RusRiskEngine.detectar(propuesta);

            if (riesgos.length === 0) {
                continue;
            }

            const poliza = RusPolizaMapper.mapear(propuesta, productor, riesgos);

            polizasRiesgosas.push(poliza);
        }

        //debug trazo8
        const duracionDeteccionRiesgos = Date.now() - inicioDeteccionRiesgos;
        const inicioEliminacionDuplicados = Date.now();

        const polizasSinDuplicados = this.eliminarDuplicados(polizasRiesgosas);

        //debug trazo9
        const duracionEliminacionDuplicados =
        Date.now() - inicioEliminacionDuplicados;
        const duracionTotal = Date.now() - inicioSincronizacion;

        //debug trazo10: print metrics
        console.log("");
        console.log("==================================================");
        console.log("MÉTRICAS RUS SYNC");
        console.log("==================================================");

        console.log({
            propuestasConsultadas: propuestasConsultadas.length,
            propuestasVigentes: propuestasVigentes.length,
            riesgosDetectados: polizasSinDuplicados.length,
            obtencionCartera: formatearDuracion(duracionObtencionCartera),
            filtradoVigentes: formatearDuracion(duracionFiltradoVigentes),
            diagnostico: formatearDuracion(duracionDiagnostico),
            deteccionRiesgos: formatearDuracion(duracionDeteccionRiesgos),
            eliminacionDuplicados: formatearDuracion(
                duracionEliminacionDuplicados
            ),
            duracionTotal: formatearDuracion(duracionTotal)
        });

        return {
            propuestasConsultadas: propuestasConsultadas.length,
            propuestasVigentes: propuestasVigentes.length,
            riesgosDetectados: polizasSinDuplicados.length,
            polizas: polizasSinDuplicados
        };
    }

    /**
     * Considera únicamente pólizas válidas y vigentes.
     */
    private esPropuestaVigente(propuesta: RusPropuesta): boolean {

        if (!Number.isFinite( propuesta.numeroPoliza) || propuesta.numeroPoliza <= 0) {
            return false;
        }

        if (propuesta.premio <= 0) {
            return false;
        }

        const estado = propuesta.vigenciaEstado?.trim().toUpperCase();

        return estado === "VIGENTE";
    }

    /**
     * Elimina duplicados por número de póliza.
     *
     * Si aparecen varios endosos de la misma póliza,
     * conserva el endoso más alto.
     */
    private eliminarDuplicados(polizas: Poliza[]): Poliza[] {

        const map = new Map<string, Poliza>();

        for (const poliza of polizas) {

            const existente = map.get(poliza.id);

            if (!existente) {
                map.set(poliza.id,poliza);
                continue;
            }

            const endosoExistente = existente.detallePoliza.endoso ?? 0;

            const endosoNuevo = poliza.detallePoliza.endoso ?? 0;

            if (endosoNuevo >= endosoExistente) {
                map.set(poliza.id, poliza);
            }
        }
        return Array.from(map.values());
    }
    
}