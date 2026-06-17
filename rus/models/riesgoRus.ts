export interface RiesgoRUS {

    codigoProductor: number;
    nombreProductor?: string;
    tipo: "FLOTA" | "PREMIO_ALTO";
    poliza: number;
    asegurado: string;
    patente: string | null;
    cantidadVehiculos: number;
    premio: number;
    cobertura: string;
    desde: string;
    hasta: string;
    estadoPoliza: string;
    vigenciaEstado: string;
    diasParaVencer: number;
    seccion: string;
    numeroSeccion: number;
    interesAsegurable: string | null;
    
}