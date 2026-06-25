export interface MercantilBienesPoliza {

    poliza: number;

    endoso: number;

    offset: number;

    limit: number;

    cantidad: number;

    total: number;

    datos: MercantilBien[];
}

export interface MercantilBien {

    id: number;

    descripcion: string;

    cobertura: string;

    suma: number;

    premio: number;

    estado: string;
}