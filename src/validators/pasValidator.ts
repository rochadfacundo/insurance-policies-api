import { PAS, TipoGestionPAS } from "../models/pas";
import { EstadoCodigoAseguradora,  EstadoRC} from "../models/aseguradora";



const ESTADOS_PAS = ["ACTIVO", "BAJA", "PENDIENTE"];

const TIPOS_GESTION: TipoGestionPAS[] = [
  "EJECUTIVA_ASIGNADA",
  "GESTIONADO_POR_ORGANIZADOR",
  "AUTOGESTIONADO",
  "SIN_ASIGNAR"
];
const ESTADOS_RC: EstadoRC[] = [
  "VIGENTE",
  "NO_TIENE",
  "EN_TRAMITE",
  "DESCONOCIDO"
];

const ESTADOS_CODIGO: EstadoCodigoAseguradora[] = [
  "PROPIO",
  "SUBCODIGO",
  "OTRA_ORGANIZACION",
  "BAJA",
  "PENDIENTE",
  "SIN_CODIGO",
  "REVISAR"
];

const esObjeto = (
  valor: unknown
): valor is Record<string, unknown> =>
  typeof valor === "object" &&
  valor !== null &&
  !Array.isArray(valor);

const esTextoOpcional = (valor: unknown): boolean =>
  valor === undefined ||
  valor === null ||
  typeof valor === "string";

const esTexto = (valor: unknown): boolean =>
  typeof valor === "string" && valor.trim().length > 0;

const esContactoValido = (valor: unknown): boolean => {
  if (!esObjeto(valor)) return false;

  const campos = [
    "telefono",
    "telefonoAlternativo",
    "email",
    "emailAlternativo",
    "fechaNacimiento",
    "domicilioParticular",
    "domicilioComercial",
    "redesSociales"
  ];

  return campos.every(campo =>
    esTextoOpcional(valor[campo])
  );
};

const esCodigoAseguradoraValido = (valor: unknown): boolean => {
  if (!esObjeto(valor)) return false;

  return (
    esTexto(valor["aseguradoraId"]) &&
    Array.isArray(valor["codigos"]) &&
    valor["codigos"].every(esTexto) &&
    ESTADOS_CODIGO.includes(
      valor["estado"] as EstadoCodigoAseguradora
    ) &&
    esTextoOpcional(valor["valorOriginal"]) &&
    esTextoOpcional(valor["observacion"])
  );
};


/**
 * Valida la unicidad de los códigos comerciales dentro
 * de las vinculaciones de un productor.
 *
 * Permite múltiples vinculaciones con una misma aseguradora
 * siempre que sus códigos comerciales no estén duplicados.
 *
 * Un mismo código puede existir en distintas aseguradoras,
 * dado que cada compañía administra su propia numeración.
 *
 * La comparación ignora espacios al inicio y al final
 * de los códigos y de los identificadores de aseguradora.
 *
 * @param valor - Vinculaciones comerciales del productor.
 * @returns true si todos los códigos son únicos por aseguradora.
 */
const tieneCodigosComercialesUnicos = (
  valor: unknown
): boolean => {

  if (!Array.isArray(valor)) {
      return false;
  }

  const codigosRegistrados = new Map<string, Set<string>>();

  for (const compania of valor) {

      if (!esObjeto(compania)) {
          return false;
      }

      const aseguradoraId = compania["aseguradoraId"];
      const codigos = compania["codigos"];

      if (
          typeof aseguradoraId !== "string" ||
          !Array.isArray(codigos)
      ) {
          return false;
      }

      const identificador = aseguradoraId.trim();

      // Cada aseguradora posee su propio conjunto de códigos.
      const registrados =
          codigosRegistrados.get(identificador) ??
          new Set<string>();

      for (const valorCodigo of codigos) {

          if (typeof valorCodigo !== "string") {
              return false;
          }

          const codigo = valorCodigo.trim();

          // Un código no puede repetirse dentro de la misma
          // aseguradora, incluso si posee otro estado comercial.
          if (registrados.has(codigo)) {
              return false;
          }

          registrados.add(codigo);
      }

      codigosRegistrados.set(
          identificador,
          registrados
      );
  }

  return true;
};


/**
 * Valida la coherencia de la gestión por organizador.
 */
const esGestionOrganizativaValida = (valor: Record<string, unknown>): boolean => {

  if (valor["tipoGestion"] !== "GESTIONADO_POR_ORGANIZADOR") {
    return true;
  }

  return (
    esTexto(valor["productorSuperiorId"]) &&
    valor["productorSuperiorId"] !== valor["id"] &&
    valor["ejecutivaId"] === null
  );
};


/**
 * Comprueba que un documento recuperado de Firestore
 * tenga la estructura esperada de un PAS.
 *
 * No modifica los datos originales.
 */
export const esPASValido = (valor: unknown): valor is PAS => {
  if (!esObjeto(valor)) return false;

  return (
    esTexto(valor["id"]) &&
    esTexto(valor["nombre"]) &&
    esTextoOpcional(valor["matricula"]) &&

    ESTADOS_PAS.includes(valor["estado"] as string) &&

    esTextoOpcional(valor["clasificacion"]) &&
    esTextoOpcional(valor["vinculo"]) &&
    esTextoOpcional(valor["actividadPrincipal"]) &&

    (
      valor["tieneRC"] === true ||
      valor["tieneRC"] === false ||
      valor["tieneRC"] === null
    ) &&

    ESTADOS_RC.includes(valor["estadoRC"] as EstadoRC) &&

    esTextoOpcional(valor["ejecutivaId"]) &&

    (
      valor["tipoGestion"] === undefined ||
      TIPOS_GESTION.includes(
        valor["tipoGestion"] as TipoGestionPAS
      )
    ) &&

    esContactoValido(valor["contacto"]) &&

    // Valida la estructura y la integridad de las vinculaciones.
    Array.isArray(valor["companias"]) &&
    valor["companias"].every(esCodigoAseguradoraValido) &&
    tieneCodigosComercialesUnicos(valor["companias"]) &&

    (
      valor["otrasCompanias"] === undefined ||
      (
        Array.isArray(valor["otrasCompanias"]) &&
        valor["otrasCompanias"].every(
          (compania: unknown) => typeof compania === "string"
        )
      )
    ) &&
    esTextoOpcional(valor["particularidades"]) &&
    esTextoOpcional(valor["productorSuperiorId"]) &&
    esGestionOrganizativaValida(valor) &&

    (valor["origen"] === "EXCEL" || valor["origen"] === "MANUAL") &&
    (valor["filaOrigen"] === undefined ||
    (typeof valor["filaOrigen"] === "number" && Number.isInteger(valor["filaOrigen"]) && valor["filaOrigen"] > 0))
  );
};

