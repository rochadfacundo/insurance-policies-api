import { TipoRiesgo } from "../../../models/TipoRiesgo";

export interface RiesgoRUS {

    codigoProductor: number;
    nombreProductor?: string;
    poliza: number;
    asegurado: string;
    patente: string | null;
    cantidadVehiculos: number;
    premio: number;
    cobertura: string;
    /**
         * Inicio real de la vigencia de la póliza.
         */
    inicioVigencia: string;

    /**
     * Fin real de la vigencia de la póliza.
     */
    finVigencia: string;

    /**
     * Fin del período actual de facturación.
     * Es la próxima fecha de refacturación.
     */
    finPeriodoFacturacion: string;

    /**
     * Días restantes hasta la próxima refacturación.
     */
    diasParaRefacturar: number;
    estadoPoliza: string;
    vigenciaEstado: string;
    seccion: string;
    numeroSeccion: number;
    tipo: TipoRiesgo;
    interesAsegurable: string | null;
    
}