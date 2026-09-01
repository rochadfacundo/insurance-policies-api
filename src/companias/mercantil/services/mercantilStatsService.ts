import { MercantilCarteraService } from "./mercantilCarteraService";
import { StatsCartera } from "../../../models/statsCartera";
import { ECompania } from "../../../models/eCompania";
import { Productor } from "../../../models/productor";
import { MercantilPoliza } from "../models/mercantilModelPolizas";


export class MercantilCarteraStatsService {

    constructor(private readonly carteraService = new MercantilCarteraService()) {}

    /**
     * Obtiene estadísticas de cartera para un conjunto de productores. 
     * @param productores productores de los cuales se desea obtener estadísticas de cartera. 
     * @returns Un objeto StatsCartera que contiene información agregada de la cartera de los productores proporcionados.
     * @see StatsCartera 
     */
    async obtener(productores: Productor[]): Promise<StatsCartera> {

        if (productores.length === 0) {
            throw new Error("No se recibieron productores para calcular estadísticas.");
        }

        const productorPrincipal = productores[0];

        if (!productorPrincipal) {
            throw new Error("No se pudo determinar el productor principal.");
        }


        const polizasPorNumero = new Map<number, MercantilPoliza>();


        for (const productor of productores) {

            const cartera = await this.carteraService.obtenerCarteraCompleta(productor.codigo);


            for (const poliza of cartera.getPolizas()) {

                polizasPorNumero.set(poliza.poliza, poliza);
            }
        }

        // Ahora construimos la estadística de cartera
        const estadistica: StatsCartera = {
            matricula: productorPrincipal.matricula,
            nombreProductor: productorPrincipal.nombre,
            codigosProductor: productores.map(
                productor => productor.codigo
            ),
            compania: ECompania.MERCANTIL_ANDINA,
            cantidadPolizas: polizasPorNumero.size
        };
        
        // Si el productor principal tiene grupo de cartera, lo agregamos a la estadística
        if (productorPrincipal.grupoCartera) {
            estadistica.grupoCartera = productorPrincipal.grupoCartera;
        }
        
        
        return estadistica;
    }
}