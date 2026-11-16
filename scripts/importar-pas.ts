
import * as ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import * as admin from "firebase-admin";
import { FirestorePASRepository } from "../src/repositories/firestorePASRepository";

import { PAS, EstadoPAS } from "../src/models/pas";

import {
  CodigoAseguradora,
  EstadoCodigoAseguradora,
  EstadoRC
} from "../src/models/aseguradora";
import { FirebaseConfig } from "../src/config/firebaseConfig";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ARCHIVO = path.resolve(
  __dirname,
  "data/AGENDA GENERAL PAS.xlsx"
);

const HOJA = "PRODUCTORES";

const SALIDA = path.resolve(
  __dirname,
  "resultado-importacion-pas.json"
);
const IMPORTAR = process.argv.includes("--importar");


/**
 * Única matrícula cuya unificación fue revisada
 * y autorizada a partir de la agenda original.
 */
const MATRICULA_UNIFICABLE = "87377";

const EMAIL_UNIFICADO = "gmasesoradeseguros@gmail.com";

// ============================================================
// COLUMNAS DEL EXCEL
// ============================================================

const COLUMNAS = {
  NOMBRE: 1,
  MATRICULA: 2,
  RC: 3,

  EJECUTIVO: 16,
  VINCULO: 17,
  ESTADO: 18,
  ACTIVIDAD: 19,

  CUMPLEANIOS: 20,
  TELEFONO: 21,
  TELEFONO_ALTERNATIVO: 22,
  EMAIL: 23,
  EMAIL_ALTERNATIVO: 24,

  DOMICILIO_PARTICULAR: 25,
  DOMICILIO_COMERCIAL: 26,
  PARTICULARIDADES: 27,
  OTRAS_COMPANIAS: 28,
  REDES_SOCIALES: 29
} as const;

/**
 * Relación entre las columnas del Excel y los
 * identificadores del catálogo de aseguradoras.
 */
const COLUMNAS_ASEGURADORAS = [
  { columna: 4, id: "mercantil-andina" },
  { columna: 5, id: "rio-uruguay" },
  { columna: 6, id: "federacion-patronal" },
  { columna: 7, id: "rivadavia" },
  { columna: 8, id: "barbus" },
  { columna: 9, id: "atm" },
  { columna: 10, id: "life" },
  { columna: 11, id: "smg-life" },
  { columna: 12, id: "digna" },
  { columna: 13, id: "evolucion" },
  { columna: 14, id: "zona-art" },
  { columna: 15, id: "nacion" }
] as const;

// ============================================================
// INTERFACES DEL REPORTE
// ============================================================

interface RegistroSimulado {
  fila: number;
  filasOrigen: number[];

  pas: PAS;

  ejecutivoExcel: string | null;
  rcOriginal: string | null;

  codigosOriginales: Record<string, string>;

  advertencias: string[];
}

interface MatriculaDuplicada {
  matricula: string;
  filas: number[];
}

interface CodigoPendienteRevision {
  fila: number;
  productor: string;
  aseguradoraId: string;
  valorOriginal: string;
}

interface ResultadoRC {
  tieneRC: boolean | null;
  estadoRC: EstadoRC;
}

interface ResultadoCodigo {
    codigos: string[];
    estado: EstadoCodigoAseguradora;
    observacion?: string;
    requiereRevision: boolean;
  }

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

/**
 * Convierte el contenido de una celda de Excel a texto.
 *
 * Contempla valores simples, fechas, fórmulas,
 * hipervínculos y texto enriquecido.
 */
function texto(
  valor: ExcelJS.CellValue
): string | null {

  if (valor === null || valor === undefined) {
    return null;
  }

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === "object") {

    if (
      "text" in valor &&
      typeof valor.text === "string"
    ) {
      return valor.text.trim() || null;
    }

    if ("result" in valor) {
      return texto(valor.result as ExcelJS.CellValue);
    }

    if (
      "richText" in valor &&
      Array.isArray(valor.richText)
    ) {
      const contenido = valor.richText
        .map(fragmento => fragmento.text)
        .join("")
        .trim();

      return contenido || null;
    }

    return null;
  }

  return String(valor).trim() || null;
}

/**
 * Obtiene el contenido textual de una columna.
 */
function obtenerTexto(
  fila: ExcelJS.Row,
  columna: number
): string | null {

  return texto(fila.getCell(columna).value);
}

/**
 * Normaliza un valor para comparaciones comerciales.
 *
 * Elimina diferencias de mayúsculas, acentos
 * y espacios, sin modificar el dato original.
 */
function normalizarTexto(valor: string): string {

  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Normaliza la matrícula del productor.
 *
 * Se aceptan únicamente valores numéricos.
 * Los contactos sin matrícula permanecen
 * en el proceso de importación.
 */
function normalizarMatricula(
  valor: string | null
): string | null {

  if (!valor) {
    return null;
  }

  const normalizado = valor.replace(/\s/g, "");

  return /^\d+$/.test(normalizado)
    ? normalizado
    : null;
}

/**
 * Determina el estado operativo del PAS.
 *
 * La clasificación comercial se conserva
 * independientemente del estado resultante.
 */
function normalizarEstadoPAS(
  clasificacion: string | null,
  advertencias: string[]
): EstadoPAS {

  if (!clasificacion) {
    return "PENDIENTE";
  }

  switch (normalizarTexto(clasificacion)) {

    case "FULL":
    case "DESARROLLO":
    case "NUEVA":
      return "ACTIVO";

    case "BAJA":
      return "BAJA";

    default:
      advertencias.push(
        `Clasificación comercial no reconocida: "${clasificacion}"`
      );

      return "PENDIENTE";
  }
}

/**
 * Interpreta la situación de responsabilidad
 * civil profesional registrada en el Excel.
 *
 * NUEVO e INTERESADO se consideran situaciones
 * potencialmente en trámite, sin confirmar
 * la existencia de una cobertura vigente.
 */
function normalizarRC(
  valor: string | null,
  advertencias: string[]
): ResultadoRC {

  if (!valor) {
    return {
      tieneRC: null,
      estadoRC: "DESCONOCIDO"
    };
  }

  switch (normalizarTexto(valor)) {

    case "SI":
      return {
        tieneRC: true,
        estadoRC: "VIGENTE"
      };

    case "NO":
      return {
        tieneRC: false,
        estadoRC: "NO_TIENE"
      };

    case "NUEVO":
    case "INTERESADO":
      advertencias.push(
        `RC posiblemente en trámite: "${valor}". Requiere confirmación.`
      );

      return {
        tieneRC: null,
        estadoRC: "EN_TRAMITE"
      };

    default:
      advertencias.push(
        `Estado RC no reconocido: "${valor}"`
      );

      return {
        tieneRC: null,
        estadoRC: "DESCONOCIDO"
      };
  }
}

/**
 * Convierte fechas de Excel al formato YYYY-MM-DD.
 *
 * Se conserva el contenido original cuando
 * no corresponde a una fecha numérica.
 */
function normalizarFecha(
  valor: ExcelJS.CellValue
): string | null {

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === "number") {

    const fecha = new Date(
      Math.round((valor - 25569) * 86400 * 1000)
    );

    return !isNaN(fecha.getTime())
      ? fecha.toISOString().slice(0, 10)
      : null;
  }

  return texto(valor);
}

/**
 * Verifica el formato básico de una dirección
 * de correo electrónico.
 *
 * No comprueba que la casilla exista.
 */
function esEmailValido(valor: string): boolean {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

/**
 * Normaliza un correo electrónico.
 *
 * Los valores inválidos no se incorporan
 * a los campos de contacto y quedan registrados
 * como advertencias para su revisión.
 */
function normalizarEmail(
  valor: string | null,
  campo: string,
  advertencias: string[]
): string | null {

  if (!valor) {
    return null;
  }

  const normalizado = valor.trim();

  if (!esEmailValido(normalizado)) {

    advertencias.push(
      `${campo} inválido: "${valor}"`
    );

    return null;
  }

  return normalizado.toLowerCase();
}

/**
 * Une textos distintos sin duplicar información.
 *
 * Se utiliza para preservar observaciones
 * procedentes de múltiples filas del Excel.
 */
function unirTextos(
  primero: string | null | undefined,
  segundo: string | null | undefined
): string | null {

  const valores = [primero, segundo]
    .filter((valor): valor is string =>
      typeof valor === "string" &&
      valor.trim().length > 0
    );

  const unicos = Array.from(new Set(valores));

  return unicos.length > 0
    ? unicos.join(" | ")
    : null;
}

/**
 * Devuelve el primer valor disponible.
 *
 * Durante la unificación se prioriza
 * el registro principal.
 */
function primerValor(
  primero: string | null | undefined,
  segundo: string | null | undefined
): string | null {

  return primero || segundo || null;
}

/**
 * Interpreta observaciones comerciales registradas en las columnas
 * de aseguradoras del archivo Excel.
 *
 * Estas columnas pueden contener información administrativa o comercial
 * en lugar de códigos numéricos.
 *
 * La función identifica situaciones conocidas y determina el estado
 * correspondiente sin modificar el valor original.
 *
 * @param valor - Contenido original de la celda.
 * @returns Estado y descripción normalizados, o null si no existe
 *          una regla de interpretación aplicable.
 */
function interpretarObservacionComercial(
    valor: string
  ): {
    estado: EstadoCodigoAseguradora;
    observacion: string;
  } | null {
  
    const normalizado = normalizarTexto(valor);
  
    // Identifica códigos dados de baja en una aseguradora.
    // Esta condición no modifica el estado general del PAS.
    if (
      normalizado === "BAJA" ||
      normalizado === "DADO DE BAJA" ||
      normalizado === "DADO DE BAJO" ||
      normalizado === "COD DADO BAJA"
    ) {
      return {
        estado: "BAJA",
        observacion: "Código dado de baja en la aseguradora"
      };
    }
  
    // Identifica solicitudes pendientes de documentación.
    if (
      normalizado.includes("ESPERANDO DOC") ||
      normalizado.includes("ESP DOC")
    ) {
      return {
        estado: "PENDIENTE",
        observacion: "Documentación pendiente"
      };
    }
  
    // Identifica trámites relacionados con cambios de organización.
    if (
      normalizado.includes("CAMBIO ORGANIZADOR") ||
      normalizado.includes("CAMBIO ORGANIZACION") ||
      normalizado.includes("CAMB ORGANIZACION") ||
      normalizado.includes("PTE DE CAMBIO") ||
      normalizado.includes("EN GESTION DEL CAMBIO")
    ) {
      return {
        estado: "PENDIENTE",
        observacion: "Cambio de organización en gestión"
      };
    }
  
    // Identifica restricciones geográficas para operar.
    if (
      normalizado.includes("NO POR ZONA") ||
      normalizado.includes("NO X ZONA")
    ) {
      return {
        estado: "REVISAR",
        observacion: "Restricción comercial por zona"
      };
    }
  
    // Identifica restricciones de autorización comercial.
    if (normalizado === "NO AUTORIZADO") {
      return {
        estado: "REVISAR",
        observacion: "Operación no autorizada"
      };
    }
  
    // Identifica observaciones relacionadas con antecedentes crediticios.
    if (normalizado.includes("VERAZ")) {
      return {
        estado: "REVISAR",
        observacion: "Observación comercial relacionada con situación crediticia"
      };
    }
  
    // El valor no coincide con ninguna observación conocida.
    return null;
  }

  /**
 * Analiza el contenido de una celda correspondiente a una aseguradora
 * y determina los códigos y el estado comercial del PAS.
 *
 * El procesamiento contempla:
 * - Ausencia explícita de código.
 * - Códigos propios, individuales o múltiples.
 * - Subcódigos identificados mediante prefijos o sufijos.
 * - Vinculaciones con otras organizaciones.
 * - Bajas y gestiones administrativas pendientes.
 * - Observaciones comerciales conocidas.
 * - Valores ambiguos que requieren revisión manual.
 *
 * No modifica el contenido original del Excel. La conservación de
 * dicho contenido corresponde a construirCodigoAseguradora().
 *
 * @param valorOriginal - Texto original de la celda.
 * @returns Códigos identificados, estado normalizado, indicador
 *          de revisión y observación comercial cuando corresponda.
 */
function procesarCodigo(valorOriginal: string): ResultadoCodigo {

    const valor = valorOriginal.trim();
    const normalizado = normalizarTexto(valor);
  
    // Identifica la ausencia explícita de un código.
    if (
      !valor ||
      normalizado === "-" ||
      normalizado === "SIN CODIGO"
    ) {
      return {
        codigos: [],
        estado: "SIN_CODIGO",
        requiereRevision: false
      };
    }
  
    // Identifica códigos gestionados mediante otra organización.
    if (
      normalizado.includes("OTRO ORG") ||
      normalizado.includes("OTRA ORG") ||
      normalizado.includes("CON OTRA ORG")
    ) {
      return {
        codigos: [],
        estado: "OTRA_ORGANIZACION",
        requiereRevision: false
      };
    }
  
    // Interpreta estados administrativos y observaciones comerciales.
    const observacionComercial =
      interpretarObservacionComercial(valor);
  
    if (observacionComercial) {
      return {
        codigos: [],
        estado: observacionComercial.estado,
        observacion: observacionComercial.observacion,
        requiereRevision:
          observacionComercial.estado === "REVISAR"
      };
    }
  
    // Identifica solicitudes expresamente pendientes de asignación.
    if (normalizado === "PENDIENTE") {
      return {
        codigos: [],
        estado: "PENDIENTE",
        requiereRevision: false
      };
    }
  
    // Identifica códigos numéricos precedidos por la abreviatura COD.
    // Los códigos se conservan como string para mantener ceros iniciales.
    const codigoConPrefijo = valor.match(
      /^COD\.?\s+(\d+)$/i
    );
  
    if (codigoConPrefijo?.[1]) {
      return {
        codigos: [codigoConPrefijo[1]],
        estado: "PROPIO",
        requiereRevision: false
      };
    }
  
    // Identifica subcódigos expresados con prefijo SUB.
    // Ejemplos: SUB-15029, SUB15029, SUB 15029.
    const subcodigoConPrefijo = valor.match(
      /^SUB[\s-]*(\d+)$/i
    );
  
    if (subcodigoConPrefijo?.[1]) {
      return {
        codigos: [subcodigoConPrefijo[1]],
        estado: "SUBCODIGO",
        requiereRevision: false
      };
    }
  
    // Identifica subcódigos expresados mediante un sufijo descriptivo.
    // Ejemplo: 22828 sub codigo.
    const subcodigoConSufijo = valor.match(
      /^(\d+)\s+SUB\s*C[OÓ]DIGO$/i
    );
  
    if (subcodigoConSufijo?.[1]) {
      return {
        codigos: [subcodigoConSufijo[1]],
        estado: "SUBCODIGO",
        requiereRevision: false
      };
    }
  
    // Identifica códigos propios compuestos exclusivamente por dígitos.
    if (/^\d+$/.test(valor)) {
      return {
        codigos: [valor],
        estado: "PROPIO",
        requiereRevision: false
      };
    }
  
    // Identifica múltiples códigos numéricos separados por comas
    // o punto y coma, sin interpretar guiones ni barras.
    if (/^\d+(?:\s*[,;]\s*\d+)+$/.test(valor)) {
      return {
        codigos: valor
          .split(/[,;]/)
          .map(codigo => codigo.trim()),
        estado: "PROPIO",
        requiereRevision: false
      };
    }
  
    // Conserva los valores no reconocidos para revisión manual.
    // No se infieren códigos ni estados a partir de formatos ambiguos.
    return {
      codigos: [],
      estado: "REVISAR",
      observacion: "Valor no reconocido; requiere revisión manual",
      requiereRevision: true
    };
  }




/**
 * Construye la relación comercial de un PAS con una aseguradora.
 *
 * Procesa los códigos y estados registrados en el Excel,
 * conserva el valor original y almacena las observaciones
 * comerciales identificadas durante la normalización.
 *
 * Los valores ambiguos se registran como advertencias
 * para permitir su revisión posterior.
 *
 * @param aseguradoraId - Identificador de la aseguradora.
 * @param valor - Contenido original de la celda del Excel.
 * @param advertencias - Colección de advertencias de importación.
 * @returns Relación normalizada entre el PAS y la aseguradora.
 */
function construirCodigoAseguradora(
    aseguradoraId: string,
    valor: string,
    advertencias: string[]
  ): CodigoAseguradora {
  
    const resultado = procesarCodigo(valor);
  
    // Registra los valores que requieren revisión manual.
    if (resultado.requiereRevision) {
      advertencias.push(
        `Código pendiente de revisión en ${aseguradoraId}: "${valor}"`
      );
    }
  
    // Construye la relación conservando el contenido original.
    const codigoAseguradora: CodigoAseguradora = {
      aseguradoraId,
      codigos: resultado.codigos,
      estado: resultado.estado,
      valorOriginal: valor
    };
  
    // Incorpora la observación comercial cuando está disponible.
    if (resultado.observacion !== undefined) {
      codigoAseguradora.observacion = resultado.observacion;
    }
  
    return codigoAseguradora;
  }

// ============================================================
// TRANSFORMACIÓN DE FILAS
// ============================================================

/**
 * Transforma una fila del Excel en un registro
 * PAS normalizado.
 *
 * No realiza escrituras ni consultas a Firestore.
 */
function transformarFila(
  fila: ExcelJS.Row
): RegistroSimulado | null {

  const nombre = obtenerTexto(
    fila,
    COLUMNAS.NOMBRE
  );

  if (!nombre) {
    return null;
  }

  const advertencias: string[] = [];

  // Identificación.
  const matriculaOriginal = obtenerTexto(
    fila,
    COLUMNAS.MATRICULA
  );

  const matricula = normalizarMatricula(
    matriculaOriginal
  );

  if (!matricula) {

    advertencias.push(
      `Matrícula ausente o inválida: "${matriculaOriginal ?? "vacía"}"`
    );
  }

  // Responsabilidad civil.
  const rcOriginal = obtenerTexto(
    fila,
    COLUMNAS.RC
  );

  const rc = normalizarRC(
    rcOriginal,
    advertencias
  );

  // Clasificación y estado.
  const clasificacion = obtenerTexto(
    fila,
    COLUMNAS.ESTADO
  )?.toUpperCase() ?? null;

  const estado = normalizarEstadoPAS(
    clasificacion,
    advertencias
  );

  // Ejecutiva responsable.
  const ejecutivoExcel = obtenerTexto(
    fila,
    COLUMNAS.EJECUTIVO
  );

  // Relaciones con aseguradoras.
  const companias: CodigoAseguradora[] = [];

  const codigosOriginales: Record<string, string> = {};

  for (const configuracion of COLUMNAS_ASEGURADORAS) {

    const valor = obtenerTexto(
      fila,
      configuracion.columna
    );

    if (!valor) {
      continue;
    }

    codigosOriginales[configuracion.id] = valor;

    companias.push(
      construirCodigoAseguradora(
        configuracion.id,
        valor,
        advertencias
      )
    );
  }

  // Información complementaria.
  const otrasCompanias = obtenerTexto(
    fila,
    COLUMNAS.OTRAS_COMPANIAS
  );

  const particularidades = obtenerTexto(
    fila,
    COLUMNAS.PARTICULARIDADES
  );

  // Contacto.
  const emailOriginal = obtenerTexto(
    fila,
    COLUMNAS.EMAIL
  );

  const emailAlternativoOriginal = obtenerTexto(
    fila,
    COLUMNAS.EMAIL_ALTERNATIVO
  );

  const email = normalizarEmail(
    emailOriginal,
    "Email principal",
    advertencias
  );

  const emailAlternativo = normalizarEmail(
    emailAlternativoOriginal,
    "Email alternativo",
    advertencias
  );

  // Los datos inválidos se preservan en observaciones.
  let observaciones = particularidades;

  if (emailOriginal && !email) {

    observaciones = unirTextos(
      observaciones,
      `Email principal original: ${emailOriginal}`
    );
  }

  if (emailAlternativoOriginal && !emailAlternativo) {

    observaciones = unirTextos(
      observaciones,
      `Email alternativo original: ${emailAlternativoOriginal}`
    );
  }

  // Construcción del PAS.
  const pas: PAS = {

    // El ID se asignará en la importación definitiva.
    id: "",

    nombre,
    matricula,

    estado,
    clasificacion,

    vinculo: obtenerTexto(
      fila,
      COLUMNAS.VINCULO
    ),

    actividadPrincipal: obtenerTexto(
      fila,
      COLUMNAS.ACTIVIDAD
    ),

    tieneRC: rc.tieneRC,
    estadoRC: rc.estadoRC,

    // Se resolverá contra la colección ejecutivas.
    ejecutivaId: null,

    contacto: {

      telefono: obtenerTexto(
        fila,
        COLUMNAS.TELEFONO
      ),

      telefonoAlternativo: obtenerTexto(
        fila,
        COLUMNAS.TELEFONO_ALTERNATIVO
      ),

      email,
      emailAlternativo,

      fechaNacimiento: normalizarFecha(
        fila.getCell(COLUMNAS.CUMPLEANIOS).value
      ),

      domicilioParticular: obtenerTexto(
        fila,
        COLUMNAS.DOMICILIO_PARTICULAR
      ),

      domicilioComercial: obtenerTexto(
        fila,
        COLUMNAS.DOMICILIO_COMERCIAL
      ),

      redesSociales: obtenerTexto(
        fila,
        COLUMNAS.REDES_SOCIALES
      )
    },

    companias,

    otrasCompanias: otrasCompanias
      ? [otrasCompanias]
      : [],

    particularidades: observaciones,

    productorSuperiorId: null,

    origen: "EXCEL",
    filaOrigen: fila.number
  };

  return {
    fila: fila.number,
    filasOrigen: [fila.number],

    pas,

    ejecutivoExcel,
    rcOriginal,

    codigosOriginales,
    advertencias
  };
}

/**
 * Genera un identificador estable para un PAS importado.
 *
 * Los productores matriculados se identifican por matrícula.
 * Los contactos sin matrícula se identifican por su fila
 * original dentro del archivo de origen.
 *
 * @param registro - Registro normalizado del Excel.
 * @returns Identificador único para Firestore.
 */
function generarIdPAS(registro: RegistroSimulado): string {

    if (registro.pas.matricula) {
      return `excel-mat-${registro.pas.matricula}`;
    }
  
    return `excel-fila-${registro.fila}`;
  }

// ============================================================
// DETECCIÓN DE DUPLICADOS
// ============================================================

/**
 * Identifica matrículas repetidas entre los
 * registros transformados.
 *
 * No considera duplicados los registros
 * que carecen de matrícula.
 */
function detectarDuplicados(
    registros: RegistroSimulado[]
  ): MatriculaDuplicada[] {
  
    const matriculas = new Map<string, RegistroSimulado[]>();
  
    for (const registro of registros) {
  
      const matricula = registro.pas.matricula;
  
      if (!matricula) {
        continue;
      }
  
      const encontrados = matriculas.get(matricula) ?? [];
  
      encontrados.push(registro);
  
      matriculas.set(matricula, encontrados);
    }
  
    return Array.from(matriculas.entries())
      .filter(([, encontrados]) => encontrados.length > 1)
      .map(([matricula, encontrados]) => ({
        matricula,
        filas: encontrados.flatMap(
          registro => registro.filasOrigen
        )
      }));
  }

/**
 * Combina las relaciones con aseguradoras
 * de dos registros correspondientes al mismo PAS.
 *
 * No descarta códigos ni observaciones.
 * Los conflictos se conservan para revisión.
 */
function combinarCompanias(
  principales: CodigoAseguradora[],
  adicionales: CodigoAseguradora[],
  advertencias: string[]
): CodigoAseguradora[] {

  const resultado = principales.map(compania => ({
    ...compania,
    codigos: [...compania.codigos]
  }));

  for (const adicional of adicionales) {

    const existente = resultado.find(
      compania =>
        compania.aseguradoraId === adicional.aseguradoraId
    );

    if (!existente) {

      resultado.push({
        ...adicional,
        codigos: [...adicional.codigos]
      });

      continue;
    }

    existente.codigos = Array.from(
      new Set([
        ...existente.codigos,
        ...adicional.codigos
      ])
    );

    if (existente.estado !== adicional.estado) {

      advertencias.push(
        `Estados diferentes en ${existente.aseguradoraId}: ` +
        `${existente.estado} / ${adicional.estado}`
      );

      existente.estado = "REVISAR";
    }

    const valorOriginalUnificado = unirTextos(
        existente.valorOriginal,
        adicional.valorOriginal
      );
      
      if (valorOriginalUnificado !== null) {
        existente.valorOriginal = valorOriginalUnificado;
      }

      const observacionUnificada = unirTextos(
        existente.observacion,
        adicional.observacion
      );
      
      if (observacionUnificada !== null) {
        existente.observacion = observacionUnificada;
      }
  }

  return resultado;
}

/**
 * Unifica los dos registros previamente
 * identificados de MARTINEZ GRISEL.
 *
 * Se conserva la información complementaria
 * y se utiliza el email confirmado por Mica.
 */
function unificarMartinezGrisel(
  registros: RegistroSimulado[]
): RegistroSimulado[] {

  const coincidencias = registros.filter(
    registro =>
      registro.pas.matricula === MATRICULA_UNIFICABLE
  );

  if (coincidencias.length === 0) {
    return registros;
  }

  if (coincidencias.length !== 2) {

    throw new Error(
      `Se esperaban exactamente 2 registros para ` +
      `la matrícula ${MATRICULA_UNIFICABLE}, ` +
      `pero se encontraron ${coincidencias.length}.`
    );
  }

  const principal = coincidencias[0];
    const adicional = coincidencias[1];

    if (!principal || !adicional) {
    throw new Error(
        `No se pudieron obtener los registros de la matrícula ${MATRICULA_UNIFICABLE}.`
    );
    }

const nombreEsperado = "MARTINEZ GRISEL";

  if (
    normalizarTexto(principal.pas.nombre) !== nombreEsperado ||
    normalizarTexto(adicional.pas.nombre) !== nombreEsperado
  ) {

    throw new Error(
      `Los registros de matrícula ${MATRICULA_UNIFICABLE} ` +
      `no corresponden al nombre esperado.`
    );
  }

  const advertencias = [
    ...principal.advertencias,
    ...adicional.advertencias
  ];

  const companias = combinarCompanias(
    principal.pas.companias,
    adicional.pas.companias,
    advertencias
  );

  if (
    principal.ejecutivoExcel &&
    adicional.ejecutivoExcel &&
    normalizarTexto(principal.ejecutivoExcel) !==
    normalizarTexto(adicional.ejecutivoExcel)
  ) {

    advertencias.push(
      "Las filas unificadas tienen ejecutivas diferentes."
    );
  }

  const contactoPrincipal = principal.pas.contacto;
  const contactoAdicional = adicional.pas.contacto;

  const emailAnterior = [
    contactoPrincipal.email,
    contactoPrincipal.emailAlternativo,
    contactoAdicional.email,
    contactoAdicional.emailAlternativo
  ].filter(
    (valor): valor is string => Boolean(valor)
  );

  const emailsAlternativos = Array.from(
    new Set(
      emailAnterior.filter(
        email =>
          email.toLowerCase() !== EMAIL_UNIFICADO
      )
    )
  );

  const observacionesEmail = emailsAlternativos.length > 0
    ? `Otros emails registrados: ${emailsAlternativos.join(", ")}`
    : null;

  const pasUnificado: PAS = {

    ...principal.pas,

    contacto: {

      telefono: primerValor(
        contactoPrincipal.telefono,
        contactoAdicional.telefono
      ),

      telefonoAlternativo: primerValor(
        contactoPrincipal.telefonoAlternativo,
        contactoAdicional.telefonoAlternativo
      ),

      email: EMAIL_UNIFICADO,

      emailAlternativo: emailsAlternativos.at(0) ?? null,

      fechaNacimiento: primerValor(
        contactoPrincipal.fechaNacimiento,
        contactoAdicional.fechaNacimiento
      ),

      domicilioParticular: primerValor(
        contactoPrincipal.domicilioParticular,
        contactoAdicional.domicilioParticular
      ),

      domicilioComercial: primerValor(
        contactoPrincipal.domicilioComercial,
        contactoAdicional.domicilioComercial
      ),

      redesSociales: primerValor(
        contactoPrincipal.redesSociales,
        contactoAdicional.redesSociales
      )
    },

    companias,

    otrasCompanias: Array.from(
      new Set([
        ...(principal.pas.otrasCompanias ?? []),
        ...(adicional.pas.otrasCompanias ?? [])
      ])
    ),

    particularidades: unirTextos(
      unirTextos(
        principal.pas.particularidades,
        adicional.pas.particularidades
      ),
      observacionesEmail
    )
  };

  const unificado: RegistroSimulado = {

    ...principal,

    filasOrigen: [
      ...principal.filasOrigen,
      ...adicional.filasOrigen
    ],

    pas: pasUnificado,

    codigosOriginales: {
      ...principal.codigosOriginales,
      ...adicional.codigosOriginales
    },

    advertencias
  };

  unificado.advertencias.push(
    `Registros unificados de las filas ` +
    `${unificado.filasOrigen.join(" y ")}.`
  );

  return registros.filter(
    registro =>
      registro !== principal &&
      registro !== adicional
  ).concat(unificado).sort(
    (a, b) => a.fila - b.fila
  );
}

// ============================================================
// AUDITORÍA
// ============================================================

/**
 * Obtiene los códigos que requieren
 * interpretación o revisión manual.
 */
function obtenerPendientesRevision(
  registros: RegistroSimulado[]
): CodigoPendienteRevision[] {

  const pendientes: CodigoPendienteRevision[] = [];

  for (const registro of registros) {

    for (const compania of registro.pas.companias) {

      if (compania.estado !== "REVISAR") {
        continue;
      }

      pendientes.push({
        fila: registro.fila,
        productor: registro.pas.nombre,
        aseguradoraId: compania.aseguradoraId,
        valorOriginal: compania.valorOriginal ?? ""
      });
    }
  }

  return pendientes;
}

// ============================================================
// PROCESO PRINCIPAL
// ============================================================

/**
 * Ejecuta el proceso de importación de productores PAS.
 *
 * Lee y normaliza los datos del Excel, unifica los registros
 * previamente autorizados, valida identificadores y genera
 * un reporte de auditoría.
 *
 * Por defecto funciona en modo simulación.
 * La escritura en Firestore requiere el argumento --importar.
 */
async function main(): Promise<void> {

    const inicio = Date.now();
  
    console.log("");
    console.log("========================================");
    console.log(
      IMPORTAR
        ? "IMPORTACIÓN PAS - MODO REAL"
        : "IMPORTACIÓN PAS - MODO SIMULACIÓN"
    );
    console.log("========================================");
  
    console.log(`Archivo: ${ARCHIVO}`);
    console.log(`Hoja: ${HOJA}`);
  
    // ==========================================================
    // VALIDACIÓN DEL ARCHIVO
    // ==========================================================
  
    if (!fs.existsSync(ARCHIVO)) {
      throw new Error(
        `No se encontró el archivo Excel: ${ARCHIVO}`
      );
    }
  
    // ==========================================================
    // LECTURA DEL EXCEL
    // ==========================================================
  
    const workbook = new ExcelJS.Workbook();
  
    await workbook.xlsx.readFile(ARCHIVO);
  
    const hoja = workbook.getWorksheet(HOJA);
  
    if (!hoja) {
      throw new Error(
        `No existe la hoja "${HOJA}" en el Excel.`
      );
    }
  
    const registrosOriginales: RegistroSimulado[] = [];
  
    hoja.eachRow((fila, numeroFila) => {
  
      // Se omite la fila de encabezados.
      if (numeroFila === 1) {
        return;
      }
  
      const registro = transformarFila(fila);
  
      if (registro) {
        registrosOriginales.push(registro);
      }
    });
  
    // ==========================================================
    // DETECCIÓN DE DUPLICADOS Y UNIFICACIÓN
    // ==========================================================
  
    const duplicadasOriginales = detectarDuplicados(
      registrosOriginales
    );
  
    const registros = unificarMartinezGrisel(
      registrosOriginales
    );
  
    const duplicadasPendientes = detectarDuplicados(
      registros
    );
  
    for (const duplicada of duplicadasPendientes) {
  
      for (const registro of registros) {
  
        if (registro.pas.matricula === duplicada.matricula) {
  
          registro.advertencias.push(
            `Matrícula duplicada pendiente: ${duplicada.matricula}`
          );
        }
      }
    }
  
    // ==========================================================
    // GENERACIÓN Y VALIDACIÓN DE IDENTIFICADORES
    // ==========================================================
  
    // Asigna identificadores estables a los registros normalizados.
    for (const registro of registros) {
      registro.pas.id = generarIdPAS(registro);
    }
  
    const ids = registros.map(
      registro => registro.pas.id
    );
  
    const idsUnicos = new Set(ids);
  
    if (idsUnicos.size !== registros.length) {
      throw new Error(
        "Se detectaron identificadores duplicados. " +
        "La importación fue cancelada."
      );
    }
  
    // ==========================================================
    // AUDITORÍA Y RESUMEN
    // ==========================================================
  
    const pendientesRevision = obtenerPendientesRevision(
      registros
    );
  
    const resumen = {
  
      filasProcesadas: registrosOriginales.length,
  
      totalPAS: registros.length,
  
      registrosUnificados:
        registrosOriginales.length - registros.length,
  
      conMatricula: registros.filter(
        registro => registro.pas.matricula !== null
      ).length,
  
      sinMatricula: registros.filter(
        registro => registro.pas.matricula === null
      ).length,
  
      matriculasDuplicadasOriginales:
        duplicadasOriginales.length,
  
      matriculasDuplicadasPendientes:
        duplicadasPendientes.length,
  
      conAdvertencias: registros.filter(
        registro => registro.advertencias.length > 0
      ).length,
  
      sinEjecutivo: registros.filter(
        registro => !registro.ejecutivoExcel
      ).length,
  
      cantidadCodigos: registros.reduce(
        (total, registro) =>
          total + registro.pas.companias.reduce(
            (subtotal, compania) =>
              subtotal + compania.codigos.length,
            0
          ),
        0
      ),
  
      codigosPendientesRevision:
        pendientesRevision.length,
  
      estadosPAS: {
  
        activos: registros.filter(
          registro => registro.pas.estado === "ACTIVO"
        ).length,
  
        bajas: registros.filter(
          registro => registro.pas.estado === "BAJA"
        ).length,
  
        pendientes: registros.filter(
          registro => registro.pas.estado === "PENDIENTE"
        ).length
      }
    };
  
    // ==========================================================
    // VALIDACIONES PREVIAS A LA IMPORTACIÓN
    // ==========================================================
  
    // No se permite importar registros con matrículas duplicadas.
    if (IMPORTAR && duplicadasPendientes.length > 0) {
      throw new Error(
        "Existen matrículas duplicadas pendientes de resolver."
      );
    }
  
    // Validación específica de la importación inicial.
    // Evita cargar accidentalmente un Excel diferente
    // al que fue auditado durante la simulación.
    if (IMPORTAR) {
  
      if (
        resumen.filasProcesadas !== 313 ||
        resumen.totalPAS !== 312 ||
        resumen.conMatricula !== 296 ||
        resumen.sinMatricula !== 16 ||
        resumen.registrosUnificados !== 1
      ) {
        throw new Error(
          "Los totales del Excel no coinciden con la " +
          "simulación auditada. Se canceló la importación."
        );
      }
    }
  
    // ==========================================================
    // GENERACIÓN DEL REPORTE
    // ==========================================================
  
    const reporte = {
  
      modo: IMPORTAR
        ? "IMPORTACION_SOLICITADA"
        : "DRY_RUN",
  
      archivo: path.basename(ARCHIVO),
  
      hoja: HOJA,
  
      fecha: new Date().toISOString(),
  
      resumen,
  
      matriculasDuplicadasOriginales:
        duplicadasOriginales,
  
      matriculasDuplicadasPendientes:
        duplicadasPendientes,
  
      pendientesRevision,
  
      registros
    };
  
    fs.writeFileSync(
      SALIDA,
      JSON.stringify(reporte, null, 2),
      "utf8"
    );
  
    // ==========================================================
    // RESULTADOS EN CONSOLA
    // ==========================================================
  
    console.log("");
    console.log("========================================");
    console.log("RESUMEN DE IMPORTACIÓN");
    console.log("========================================");
  
    console.table({
      filasProcesadas: resumen.filasProcesadas,
      totalPAS: resumen.totalPAS,
      registrosUnificados: resumen.registrosUnificados,
      conMatricula: resumen.conMatricula,
      sinMatricula: resumen.sinMatricula,
      matriculasDuplicadasOriginales:
        resumen.matriculasDuplicadasOriginales,
      matriculasDuplicadasPendientes:
        resumen.matriculasDuplicadasPendientes,
      conAdvertencias: resumen.conAdvertencias,
      sinEjecutivo: resumen.sinEjecutivo,
      cantidadCodigos: resumen.cantidadCodigos,
      codigosPendientesRevision:
        resumen.codigosPendientesRevision
    });
  
    console.log("");
    console.log("ESTADOS DE PRODUCTORES:");
    console.table(resumen.estadosPAS);
  
    console.log("");
    console.log("DUPLICADOS ORIGINALES:");
    console.table(duplicadasOriginales);
  
    console.log("");
    console.log("DUPLICADOS PENDIENTES:");
    console.table(duplicadasPendientes);
  
    console.log("");
    console.log(`Reporte generado: ${SALIDA}`);
  
    // ==========================================================
    // MODO SIMULACIÓN
    // ==========================================================
  
    if (!IMPORTAR) {
  
      console.log("");
      console.log(
        `Duración: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
      );
  
      console.log("");
      console.log("No se realizaron escrituras en Firestore.");
      console.log("Simulación finalizada.");
  
      return;
    }
  
    // ==========================================================
    // CONEXIÓN A FIREBASE
    // ==========================================================

    // Reutiliza la configuración centralizada del proyecto.
    // FirebaseConfig carga las variables de entorno,
    // inicializa Firebase Admin y obtiene Firestore.
    const firestore = FirebaseConfig.getFirestore();

    const proyectoEsperado = process.env.FIREBASE_PROJECT_ID;

    if (!proyectoEsperado) {
    throw new Error(
        "No se pudo identificar el proyecto Firebase."
    );
    }

const repositorio = new FirestorePASRepository(firestore);
  
    
  
    // ==========================================================
    // IMPORTACIÓN DEFINITIVA
    // ==========================================================
  
    console.log("");
    console.log("========================================");
    console.log("IMPORTACIÓN DEFINITIVA A FIRESTORE");
    console.log("========================================");
  
    console.log(`Proyecto: ${proyectoEsperado}`);
    console.log("Colección: productores");
    console.log(`Documentos a crear: ${registros.length}`);
  
    const cantidadImportada = await repositorio.importarInicial(
      registros.map(registro => registro.pas)
    );
  
    console.log("");
    console.log("========================================");
    console.log("IMPORTACIÓN FINALIZADA");
    console.log("========================================");
  
    console.log(`PAS creados: ${cantidadImportada}`);
  
    console.log("");
    console.log(
      `Duración total: ${((Date.now() - inicio) / 1000).toFixed(2)} segundos`
    );
  }
  
  // ============================================================
  // EJECUCIÓN
  // ============================================================
  
  main().catch((error: unknown) => {
  
    console.error("");
    console.error("Error durante la importación PAS:", error);
  
    process.exitCode = 1;
  });

