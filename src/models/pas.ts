
import {
  CodigoAseguradora,
  EstadoRC
} from "./aseguradora";

/**
 * Estado operativo del Productor Asesor de Seguros (PAS).
 *
 * Es independiente de su clasificación comercial.
 */
export type EstadoPAS = | "ACTIVO" | "BAJA" | "PENDIENTE";

/**
 * Tipo de gestión del PAS dentro de Técnica y Servicios.
 */
export type TipoGestionPAS =
  | "EJECUTIVA_ASIGNADA"
  | "GESTIONADO_POR_ORGANIZADOR"
  | "AUTOGESTIONADO"
  | "SIN_ASIGNAR";

/**
 * Información de contacto del PAS.
 *
 * Los campos son opcionales porque la agenda de origen
 * puede contener información incompleta.
 */
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

/**
 * Representa a un Productor Asesor de Seguros (PAS)
 * dentro de Técnica y Servicios.
 *
 * Constituye el registro maestro del productor,
 * independientemente de las aseguradoras con las que opere.
 *
 * Colección de Firestore: "productores".
 */
export interface PAS {

  // Identificación

  /**
   * Identificador único y estable del PAS.
   *
   * Corresponde al ID del documento en Firestore.
   * No depende de la matrícula ni de los códigos
   * asignados por las aseguradoras.
   */
  id: string;

  /** Nombre completo o denominación comercial del productor. */
  nombre: string;

  /**
   * Matrícula del PAS.
   *
   * Se almacena como string para preservar su formato.
   * Puede ser null para contactos o productores pendientes
   * de matriculación.
   *
   * No se utiliza como identificador del documento.
   */
  matricula: string | null;

  // Situación comercial

  /**
   * Estado operativo del PAS dentro de la organización.
   *
   * No debe confundirse con la clasificación comercial
   * ni con el estado de sus códigos en las aseguradoras.
   */
  estado: EstadoPAS;

  /**
   * Clasificación comercial registrada en la agenda.
   *
   * Ejemplos: FULL, DESARROLLO, NUEVA, BAJA.
   */
  clasificacion?: string | null;

  /** Tipo de vínculo comercial con Técnica y Servicios. */
  vinculo?: string | null;

  /** Actividad principal declarada por el productor. */
  actividadPrincipal?: string | null;

  // Responsabilidad civil profesional

  /**
   * Indica si el PAS cuenta con cobertura de RC profesional.
   *
   * true: cobertura confirmada.
   * false: no posee cobertura.
   * null: situación desconocida o no confirmada.
   *
   * Se conserva por compatibilidad con el modelo inicial.
   */
  tieneRC: boolean | null;

  /**
   * Estado detallado de la cobertura de RC profesional.
   *
   * Permite distinguir una cobertura vigente de una
   * solicitud en trámite o una situación desconocida.
   */
  estadoRC: EstadoRC;

  // Ejecutiva responsable

  /**
   * ID de la ejecutiva asignada al PAS.
   *
   * Referencia un documento de la colección "ejecutivas".
   *
   * La asignación corresponde al productor en general,
   * independientemente de las aseguradoras con las que opere.
   */
  ejecutivaId: string | null;

  // Información de contacto

  /** Datos personales y comerciales de contacto del PAS. */
  contacto: ContactoPAS;

  // Relación con aseguradoras

  /**
   * Vinculaciones comerciales del productor con las aseguradoras.
   *
   * Una misma aseguradora puede aparecer en múltiples registros
   * cuando sus códigos comerciales poseen estados diferentes.
   */
  companias: CodigoAseguradora[];

  // Información adicional

  /**
   * Otras aseguradoras declaradas en la agenda
   * que no necesariamente forman parte del catálogo.
   */
  otrasCompanias?: string[];

  /** Observaciones comerciales o administrativas del PAS. */
  particularidades?: string | null;

  // Relaciones entre productores

  /**
   * ID del PAS con el que mantiene una relación
   * jerárquica dentro de una organización.
   *
   * Cuando el tipo de gestión es GESTIONADO_POR_ORGANIZADOR,
   * identifica al productor responsable de su gestión.
   *
   * La pertenencia a una organización no implica
   * necesariamente que el PAS sea atendido por ella:
   * puede tener una ejecutiva asignada directamente.
   */
  productorSuperiorId?: string | null;

  // Gestión interna
  tipoGestion?: TipoGestionPAS;

  // Trazabilidad y auditoría

  /**
   * Origen del registro.
   *
   * EXCEL: importado desde la agenda de productores.
   * MANUAL: creado directamente desde el sistema.
   */
  origen: "EXCEL" | "MANUAL";

  /**
   * Número de fila del Excel utilizado durante la importación.
   *
   * Facilita la identificación y revisión de registros
   * provenientes de la agenda original.
   */
  filaOrigen?: number;

  /** Fecha de creación del registro en el sistema. */
  fechaCreacion?: Date;

  /** Fecha de la última modificación del registro. */
  fechaActualizacion?: Date;
}

