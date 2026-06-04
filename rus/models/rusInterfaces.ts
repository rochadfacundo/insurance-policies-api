export interface RusPaging {
    total: number;
    limit: number;
    offset: number;
}

export interface RusPropuestasRequest {
    codigoProductor: number[];
    fechaEmision: string;
    pagina: number;
}

export interface RusPropuestasResponse {
    paging: RusPaging;
    results: RusPropuesta[];
}

export interface RusPropuesta {

    id: number;

    estadoPoliza: string;

    seccion: string;
    numeroSeccion: number;

    propuesta: number;
    renovacion: number;
    endoso: number;

    premio: number;
    cantidadCuota: number;
    cuota: number;

    fechaCarga: string;
    fechaEmision: string;

    inicioVigencia: string;
    finVigencia: string;

    inicioPeriodoFacturacion: string;
    finPeriodoFacturacion: string;

    numeroView: string;

    interesAsegurable: string;

    sumaAsegurada: number | null;

    productor: number;
    organizador: number;

    idSocio: number;

    razonSocial: string;

    docPersona: number;

    nombrePersona: string;

    cuit: number;

    calle: string;

    numeroFinca: number;

    codigoPostal: number;

    localidad: string;

    cobertura: string;

    tieneAccesorios: boolean;
    requiereFotos: boolean;
    requiereRastreo: boolean;
    requiereGnc: boolean;
    esGnc: boolean;
    requiereEscolar: boolean;

    propuestaProrrogaAutomatica: boolean;

    condicionEmisionPolizaList: any;

    numeroPoliza: number;

    patente: string | null;

    premioAnterior: number;

    sumaAseguradaAnterior: number;

    esCoberturaCasco: boolean;

    tieneGaleriaRemota: boolean;

    briefCargado: number;

    tarifaPorUso: boolean;

    esFlota: boolean;

    cantidadVehiculos: number;

    vigenciaEstado: string;

    codigoMoneda: string;

    porcentajeVariacionSumaAsegurada: number | null;

    porcentajeVariacionPremio: number | null;

    idMedioCobro: number;

    esCeroKm: boolean;
}