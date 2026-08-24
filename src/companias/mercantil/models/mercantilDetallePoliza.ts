export interface MercantilDetallePoliza {

    poliza: number;
    endoso: number;

    rama: {
        id: number;
        nombre: string;
    };

    desde: string;
    hasta: string;
    emitido: string;

    bien: string;
    tipo:string;
    suma: number;

    cobertura: string;

    cuotas: number;

    productor: {
        id: number;
        nombre: string;
    };

    costo: {
        premio: number;
        prima: number;
        primaRC: number;
        primaCasco: number;
    };
}