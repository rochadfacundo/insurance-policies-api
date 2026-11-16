import { CodigoAseguradora } from "./aseguradora";


export type EstadoPAS =
  | "ACTIVO"
  | "BAJA"
  | "PENDIENTE";

export interface ContactoPAS {
  telefono?: string | null;
  telefonoAlternativo?: string | null;

  email?: string | null;
  emailAlternativo?: string | null;

  fechaNacimiento?: string | null;

  domicilioParticular?: string | null;
  domicilioComercial?: string | null;

  redesSociales?: string | null;
}

export interface PAS {
  id: string;

  // Identificación
  nombre: string;
  matricula: string | null;

  // Situación comercial
  estado: EstadoPAS;
  clasificacion?: string | null;
  vinculo?: string | null;
  actividadPrincipal?: string | null;

  // Responsabilidad civil profesional
  tieneRC: boolean | null;

  // Ejecutiva responsable
  ejecutivaId: string | null;

  // Información de contacto
  contacto: ContactoPAS;

  // Códigos en aseguradoras
  companias: CodigoAseguradora[];

  // Información adicional
  otrasCompanias?: string[];
  particularidades?: string | null;

  // Relaciones futuras
  productorSuperiorId?: string | null;

  // Auditoría
  origen: "EXCEL" | "MANUAL";
  filaOrigen?: number;

  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}