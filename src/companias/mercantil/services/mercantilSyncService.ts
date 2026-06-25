import { Poliza } from "../../../models/poliza";
import { Productor } from "../../../models/productor";
import { MercantilCarteraService } from "./mercantilCarteraService";

export class MercantilSyncService {

  /**
   * Sincroniza la cartera de un productor.
   *
   * Si no se informa un rango de fechas,
   * sincroniza toda la cartera.
   */


  constructor(private readonly mercantilService = new MercantilCarteraService()) {}

  async sincronizar(productor: Productor): Promise<Poliza[]> {

    const resultado: Poliza[] = [];

    const cartera = await this.mercantilService.obtenerCarteraCompleta(productor.codigo);

    for (const polizaMercantil of cartera.getPolizas()) {

        const detalle =
        await this.mercantilService.obtenerDetallePoliza(
        polizaMercantil.poliza,
        polizaMercantil.endoso
    );

        const bienes =
          await this.mercantilService.obtenerBienesPoliza(
        polizaMercantil.poliza,
        polizaMercantil.endoso
    );

    }

    return resultado;
}

}