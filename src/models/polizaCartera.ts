import { ECompania } from "./eCompania";
import { PeriodicidadFacturacion } from "./periodicidadFacturacion";

export interface PolizaCartera {

    // Identificación
    id: string;
    compania: ECompania;

    // Asociación con el PAS
    pasId: string | null;

    // Productor informado por la compañía
    productor: {
        codigo: number;
        nombre: string;
        matricula: string | null;
        grupoCartera?: string;
    };

    // Asegurado
    asegurado: {
        nombre: string;
        codigo: number;
    };

    // Información de la póliza
    numeroPoliza: number;
    numeroPolizaAnterior: number | null;
    endoso: number;

    // Información del riesgo asegurado
    ramo: {
        codigo: number;
        nombre: string | null;
    };

    bienAsegurado: string;
    cobertura: string | null;

    // Información económica
    primaAnualizada: number | null;
    premioAnualizado: number | null;

    // Trazabilidad de la información económica
    endosoEconomico: number | null;
    historialRestringido: boolean;

    // Facturación
    facturacion: {
        desde: Date;
        hasta: Date;
    };

    periodicidadFacturacion: PeriodicidadFacturacion;

    // Vigencia contractual
    finVigencia: Date;

    // Auditoría
    fechaCreacion?: Date;
    fechaActualizacion?: Date;
}