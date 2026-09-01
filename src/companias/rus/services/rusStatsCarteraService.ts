import { ECompania } from "../../../models/eCompania";
import { StatsCartera } from "../../../models/statsCartera";
import { ProductorRUSConMatricula } from "../productoresRUS";
import { RusCarteraService } from "./rusCarteraService";

export class RusStatsCarteraService {

    constructor(private readonly carteraService = new RusCarteraService()) {}


    async obtener(productor: ProductorRUSConMatricula, fechaDesde: string, fechaHasta: string): Promise<StatsCartera> {

        const cartera = await this.carteraService.obtenerCarteraPorRango(productor.codigo, fechaDesde,fechaHasta);


        const numerosPoliza = new Set<number>();


        for (const propuesta of cartera.getPropuestas()) {

            const numeroPoliza = Number(propuesta.numeroPoliza);

            const vigencia = propuesta.vigenciaEstado ?.trim().toUpperCase();

            if (numeroPoliza > 0 && vigencia === "VIGENTE") {
                numerosPoliza.add(numeroPoliza);
            }
        }


        // Ahora construimos la estadística de cartera
        const estadistica: StatsCartera = {

            matricula: productor.matricula,
            nombreProductor: productor.nombre,
            codigosProductor: [productor.codigo],
            compania: ECompania.RIO_URUGUAY,
            cantidadPolizas: numerosPoliza.size
        };

        // Si el productor tiene grupo de cartera, lo agregamos a la estadística
        if (productor.grupoCartera) {
            estadistica.grupoCartera = productor.grupoCartera;
        }

        return estadistica;
    }
}