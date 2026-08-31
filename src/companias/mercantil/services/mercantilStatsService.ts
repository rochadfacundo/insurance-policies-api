import { MercantilCarteraService } from "./mercantilCarteraService";
import { StatsCartera } from "../../../models/statsCartera";
import { ECompania } from "../../../models/eCompania";
import { Productor } from "../../../models/productor";
import { MercantilPoliza } from "../models/mercantilModelPolizas";


export class MercantilCarteraStatsService {

    constructor(private readonly carteraService = new MercantilCarteraService()) {}


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


        return {
            matricula: productorPrincipal.matricula,
            nombreProductor: productorPrincipal.nombre,
            codigosProductor: productores.map( productor => productor.codigo),
            compania: ECompania.MERCANTIL_ANDINA,
            cantidadPolizas: polizasPorNumero.size
        };
    }
}