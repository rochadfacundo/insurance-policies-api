import axios from "axios";
import { ErrorNormalizado, ErrorProductor, ResumenGeneral } from "../models/sync";

/**
 * Módulo de utilidades para la sincronización de productores y riesgos. 
 * @param resumen resumen de la sincronización, incluyendo estadísticas y duración total. 
 * @param errores lista de errores ocurridos durante la sincronización, incluyendo código, nombre, status y mensaje de error. 
 * @returns  void
 */
export function mostrarResumen(resumen: ResumenGeneral, errores: ErrorProductor[]): void {

    console.log("");
    console.log("==================================================");
    console.log("RESUMEN GENERAL");
    console.log("==================================================");

    console.log({
        productoresTotales: resumen.productoresTotales,
        productoresProcesados: resumen.productoresProcesados,
        productoresExitosos: resumen.productoresExitosos,
        productoresConError: resumen.productoresConError,
        riesgosActuales: resumen.riesgosActuales,
        riesgosNuevos: resumen.riesgosNuevos,
        riesgosActualizados: resumen.riesgosActualizados,
        riesgosEliminados: resumen.riesgosEliminados,
        duracionTotal: resumen.duracionTotal
    });

    if (errores.length === 0) {

        console.log("");
        console.log("Sincronización completada sin errores.");

        return;
    }

    console.log("");
    console.log("==================================================");
    console.log("PRODUCTORES CON ERROR");
    console.log("==================================================");

    console.table(
        errores.map(
            error => ({
                codigo: error.codigo,
                nombre: error.nombre,
                status: error.status ?? "-",
                mensaje: error.mensaje
            })
        )
    );
}

/**
 * Normaliza un error desconocido en un objeto de error normalizado, extrayendo el mensaje,
 *  el estado HTTP y los detalles del error si están disponibles. 
 * @param error El error desconocido a normalizar. 
 * @returns Un objeto de error normalizado con el mensaje, estado y detalles del error. 
 */
export function normalizarError(error: unknown): ErrorNormalizado {

    if (axios.isAxiosError(error)) {

        const resultado: ErrorNormalizado = { mensaje: obtenerMensajeAxios(error) };

        if (error.response?.status !== undefined) {
            resultado.status = error.response.status;
        }

        if (error.response?.data !== undefined) {
            resultado.detalle = error.response.data;
        }

        return resultado;
    }

    if (error instanceof Error) {
        return {
            mensaje: error.message
        };
    }

    return {
        mensaje: "Error desconocido",
        detalle: error
    };
}

/**
 * Obtiene un mensaje de error a partir de un error de Axios, extrayendo el mensaje del cuerpo de la respuesta si está disponible. 
 * @param error El error de Axios del cual se desea obtener el mensaje. 
 * @returns El mensaje de error extraído del cuerpo de la respuesta o un mensaje genérico si no se puede obtener. 
 */
function obtenerMensajeAxios(error: unknown): string {

    if (!axios.isAxiosError(error)) {
        return "Error HTTP desconocido";
    }

    const data = error.response?.data;

    if (data !== null && typeof data === "object") {

        if ("message" in data && typeof data.message === "string" && data.message.trim().length > 0) {
            return data.message;
        }

        if ("mensaje" in data && typeof data.mensaje === "string" && data.mensaje.trim().length > 0) {
            return data.mensaje;
        }

        if ("errores" in data && Array.isArray(data.errores)) {

            const mensajes = data.errores.map(
                        (
                            item: {
                                texto?: unknown;
                                mensaje?: unknown;
                            } | null
                        ): string | undefined => {

                            if (item === null || typeof item !== "object") {
                                return undefined;
                            }

                            if (typeof item.texto === "string") {
                                return item.texto;
                            }

                            if (typeof item.mensaje === "string") {
                                return item.mensaje;
                            }

                            return undefined;
                        }
                    )
                    .filter((mensaje: string | undefined): mensaje is string => mensaje !== undefined);

            if (mensajes.length > 0) {
                return mensajes.join(" | ");
            }
        }
    }

    return (error.message || `Error HTTP ${ error.response?.status ??"desconocido"  }`);
}

/**
* Obtiene un mensaje de error a partir de un error desconocido, 
* devolviendo el mensaje del error si es una instancia de Error, o convirtiendo el error a cadena si no lo es. 
 * @param error El error desconocido del cual se desea obtener el mensaje. 
 * @returns El mensaje de error extraído o convertido a cadena.      
 */
export function obtenerMensajeError(error: unknown): string {

    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

