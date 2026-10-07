import { Cliente } from "./cliente";
import { DetallePoliza } from "./detallePoliza";
import { ECompania } from "./eCompania";
import { EstadoRefacturacion } from "./estadoRefacturacion";
import { Facturacion } from "./facturacion";
import { Productor, ProductorBase } from "./productor";
import { Riesgo } from "./riesgo";
import { TipoRiesgo } from "./TipoRiesgo";
import { Vigencia } from "./vigencia";


export interface Poliza {

  // Identificación
  id: string;

  // Compañía
  compania: ECompania;

  // Actores
  productor: ProductorBase;
  cliente: Cliente;

  // Póliza
  detallePoliza: DetallePoliza;

  // Cobertura
  riesgo: Riesgo;
  riesgos: TipoRiesgo[];

  // Fechas
  facturacion: Facturacion;

  /**
   * Próxima fecha de refacturación cuando pudo determinarse
   * explícitamente para la compañía.
   */
  fechaProximaRefacturacion?: Date;

  /**
   * Indica el resultado del análisis de próxima refacturación.
   *
   * PENDIENTE:
   * existe una próxima fecha conocida.
   *
   * SIN_REFAC_PENDIENTE:
   * se determinó que no queda otra refacturación dentro
   * de la vigencia contractual actual.
   *
   * NO_DETERMINADA:
   * las reglas actuales no permiten determinarla.
   */
  estadoRefacturacion?: EstadoRefacturacion;
  
  vigencia: Vigencia;

  fechaCreacion?: Date;
  fechaActualizacion?: Date;

}