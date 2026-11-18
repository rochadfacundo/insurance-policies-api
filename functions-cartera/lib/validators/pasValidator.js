"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esPASValido = void 0;
const ESTADOS_PAS = ["ACTIVO", "BAJA", "PENDIENTE"];
const TIPOS_GESTION = [
    "EJECUTIVA_ASIGNADA",
    "AUTOGESTIONADO",
    "SIN_ASIGNAR"
];
const ESTADOS_RC = [
    "VIGENTE",
    "NO_TIENE",
    "EN_TRAMITE",
    "DESCONOCIDO"
];
const ESTADOS_CODIGO = [
    "PROPIO",
    "SUBCODIGO",
    "OTRA_ORGANIZACION",
    "BAJA",
    "PENDIENTE",
    "SIN_CODIGO",
    "REVISAR"
];
const esObjeto = (valor) => typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor);
const esTextoOpcional = (valor) => valor === undefined ||
    valor === null ||
    typeof valor === "string";
const esTexto = (valor) => typeof valor === "string" && valor.trim().length > 0;
const esContactoValido = (valor) => {
    if (!esObjeto(valor))
        return false;
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
    return campos.every(campo => esTextoOpcional(valor[campo]));
};
const esCodigoAseguradoraValido = (valor) => {
    if (!esObjeto(valor))
        return false;
    return (esTexto(valor["aseguradoraId"]) &&
        Array.isArray(valor["codigos"]) &&
        valor["codigos"].every(esTexto) &&
        ESTADOS_CODIGO.includes(valor["estado"]) &&
        esTextoOpcional(valor["valorOriginal"]) &&
        esTextoOpcional(valor["observacion"]));
};
/**
 * Comprueba que un documento recuperado de Firestore
 * tenga la estructura esperada de un PAS.
 *
 * No modifica los datos originales.
 */
const esPASValido = (valor) => {
    if (!esObjeto(valor))
        return false;
    return (esTexto(valor["id"]) &&
        esTexto(valor["nombre"]) &&
        esTextoOpcional(valor["matricula"]) &&
        ESTADOS_PAS.includes(valor["estado"]) &&
        esTextoOpcional(valor["clasificacion"]) &&
        esTextoOpcional(valor["vinculo"]) &&
        esTextoOpcional(valor["actividadPrincipal"]) &&
        (valor["tieneRC"] === true ||
            valor["tieneRC"] === false ||
            valor["tieneRC"] === null) &&
        ESTADOS_RC.includes(valor["estadoRC"]) &&
        esTextoOpcional(valor["ejecutivaId"]) &&
        (valor["tipoGestion"] === undefined ||
            TIPOS_GESTION.includes(valor["tipoGestion"])) &&
        esContactoValido(valor["contacto"]) &&
        Array.isArray(valor["companias"]) &&
        valor["companias"].every(esCodigoAseguradoraValido) &&
        (valor["otrasCompanias"] === undefined ||
            (Array.isArray(valor["otrasCompanias"]) &&
                valor["otrasCompanias"].every((compania) => typeof compania === "string"))) &&
        esTextoOpcional(valor["particularidades"]) &&
        esTextoOpcional(valor["productorSuperiorId"]) &&
        (valor["origen"] === "EXCEL" ||
            valor["origen"] === "MANUAL") &&
        (valor["filaOrigen"] === undefined ||
            (typeof valor["filaOrigen"] === "number" &&
                Number.isInteger(valor["filaOrigen"]) &&
                valor["filaOrigen"] > 0)));
};
exports.esPASValido = esPASValido;
//# sourceMappingURL=pasValidator.js.map