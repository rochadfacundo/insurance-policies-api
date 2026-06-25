import { Cliente } from "./cliente";
import { DetallePoliza } from "./detallePoliza";
import { ECompania } from "./eCompania";
import { Facturacion } from "./facturacion";
import { Productor } from "./productor";
import { Riesgo } from "./riesgo";
import { TipoRiesgo } from "./TipoRiesgo";
import { Vigencia } from "./vigencia";


export interface Poliza {

  // Identificación
  id: string;

  // Compañía
  compania: ECompania;

  // Actores
  productor: Productor;
  cliente: Cliente;

  // Póliza
  detallePoliza: DetallePoliza;

  // Cobertura
  riesgo: Riesgo;
  riesgos: TipoRiesgo[];

  // Fechas
  facturacion: Facturacion;
  vigencia: Vigencia;

  fechaCreacion?: Date;
  fechaActualizacion?: Date;

}