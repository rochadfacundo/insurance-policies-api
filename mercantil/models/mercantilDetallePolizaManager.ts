import { MercantilDetallePoliza }
from "./mercantilDetallePoliza";

export class MercantilDetallePolizaManager {

    constructor(
        private readonly detalle:
        MercantilDetallePoliza
    ) {}

    getPoliza(): number {
        return this.detalle.poliza;
    }

    getEndoso(): number {
        return this.detalle.endoso;
    }

    getCobertura(): string {
        return this.detalle.cobertura;
    }

    getBien(): string {
        return this.detalle.bien;
    }

    getSumaAsegurada(): number {
        return this.detalle.suma;
    }

    getPremio(): number {
        return this.detalle.costo.premio;
    }

    getPrima(): number {
        return this.detalle.costo.prima;
    }

    getPrimaRC(): number {
        return this.detalle.costo.primaRC;
    }

    getPrimaCasco(): number {
        return this.detalle.costo.primaCasco;
    }

    getCantidadCuotas(): number {
        return this.detalle.cuotas;
    }

    getNombreProductor(): string {
        return this.detalle.productor.nombre;
    }

    getCodigoProductor(): number {
        return this.detalle.productor.id;
    }

    esRiesgoMayor(
        primaMinima: number = 5000000
    ): boolean {

        return this.getPrima()
            >= primaMinima;
    }

    esSumaAseguradaMayorA(
        sumaMinima: number
    ): boolean {

        return this.getSumaAsegurada()
            >= sumaMinima;
    }

    getResumen() {

        return {

            poliza:
                this.getPoliza(),

            productor:
                this.getCodigoProductor(),

            nombreProductor:
                this.getNombreProductor(),

            cobertura:
                this.getCobertura(),

            sumaAsegurada:
                this.getSumaAsegurada(),

            premio:
                this.getPremio(),

            prima:
                this.getPrima(),

            primaRC:
                this.getPrimaRC(),

            primaCasco:
                this.getPrimaCasco(),

            cuotas:
                this.getCantidadCuotas()
        };
    }
}