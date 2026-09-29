import { FedPatProductoDato }
    from "../models/fedPatProductoDato";
import { FedPatDato }
    from "../models/fedPatDato";
import { FedPatTabla }
    from "../models/fedPatTabla";

/**
 * Representa un dato de producto interpretado utilizando
 * los catálogos de Federación Patronal.
 *
 * Conservamos tanto los valores originales de la API como sus
 * descripciones resueltas para no perder información durante
 * el proceso de mapeo.
 */
export interface FedPatProductoDatoMapeado {
    codigoDato: string;
    codigoNumerico: number | null;
    descripcionDato: string | null;
    valorOriginal: string;
    valorDescripcion: string | null;
}

/**
 * Mapper responsable de interpretar los registros dinámicos
 * obtenidos desde `/productos-datos`.
 *
 * Federación identifica cada dato mediante códigos con formato
 * `Cxxxxx`. El catálogo `/datos` utiliza el mismo identificador
 * sin el prefijo `C`.
 *
 * Cuando el valor se encuentra codificado, el catálogo `/tablas`
 * permite obtener su descripción utilizando:
 *
 * dato.codigo === tabla.codigo
 * productoDato.valor_dato === tabla.indice
 *
 * Este mapper no contiene reglas específicas de Automotores ni
 * decide qué datos representan patente, chasis, marca o modelo.
 */
export class FedPatProductoDatosMapper {

    /**
     * Interpreta una colección de datos de producto utilizando
     * los catálogos de datos y tablas de Federación Patronal.
     *
     * @param productosDatos Datos originales del producto.
     * @param datos Catálogo general de códigos de datos.
     * @param tablas Tabla de valores codificados.
     * @returns Datos interpretados sin perder los valores originales.
     */
    mapear(productosDatos: FedPatProductoDato[],datos: FedPatDato[],tablas: FedPatTabla[]): FedPatProductoDatoMapeado[] {

        return productosDatos.map(productoDato => this.mapearDato(productoDato, datos, tablas));
    }

    /**
     * Interpreta un único registro de producto.
     */
    private mapearDato(productoDato: FedPatProductoDato,datos: FedPatDato[],tablas: FedPatTabla[]): FedPatProductoDatoMapeado {

        const codigoNumerico = this.obtenerCodigoNumerico(productoDato.codigo_dato);

        /*
         * Si el código pudo convertirse correctamente, buscamos
         * su significado dentro del catálogo `/datos`.
         */
        const dato = codigoNumerico === null
            ? undefined
            : datos.find(item => item.codigo === codigoNumerico);

        /*
         * Algunos valores son códigos que necesitan una segunda
         * resolución mediante `/tablas`.
         *
         * Otros, como patente o chasis, contienen directamente
         * el valor final y por lo tanto no tendrán coincidencia.
         */
        const tabla = codigoNumerico === null
            ? undefined
            : tablas.find(item => item.codigo === codigoNumerico && String(item.indice) === String(productoDato.valor_dato));

        return {
            codigoDato: productoDato.codigo_dato,
            codigoNumerico,
            descripcionDato: dato?.descripcion ?? null,
            valorOriginal: productoDato.valor_dato,
            valorDescripcion: tabla?.descripcion ?? null
        };
    }

    /**
     * Convierte un código recibido desde `/productos-datos`
     * al código numérico utilizado por los catálogos.
     *
     * Ejemplo:
     *
     * C40006 -> 40006
     *
     * Si el formato recibido no puede convertirse a un número,
     * devuelve null en lugar de asumir un valor inválido.
     */
    private obtenerCodigoNumerico(codigoDato: string): number | null {

        const codigoSinPrefijo = codigoDato.replace(/^C/i, "");

        const codigo = Number(codigoSinPrefijo);

        if (!Number.isFinite(codigo)) {
            return null;
        }

        return codigo;
    }
}