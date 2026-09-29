import { FedPatProductoDatoMapeado }
    from "./fedPatProductoDatosMapper";

/**
 * Representa la información principal de un vehículo obtenida
 * desde los datos dinámicos de producto de Federación Patronal.
 *
 * Los campos pueden ser nulos porque no todos los movimientos
 * necesariamente informan la totalidad de los datos del vehículo.
 */
export interface FedPatVehiculo {
    patente: string | null;
    chasis: string | null;
    motor: string | null;
    marca: string | null;
    modelo: string | null;
    anio: number | null;
    tipoVehiculo: string | null;
    usoVehiculo: string | null;
}

/**
 * Mapper responsable de transformar los datos dinámicos ya
 * interpretados de Federación Patronal en una estructura
 * específica para vehículos.
 *
 * Los códigos utilizados corresponden a valores reales observados
 * en el catálogo `/datos` de Federación Patronal.
 */
export class FedPatVehiculoMapper {

    /**
     * Códigos utilizados por Federación Patronal para identificar
     * los principales atributos de un vehículo.
     */
    private static readonly CODIGO_PATENTE = 40006;
    private static readonly CODIGO_CHASIS = 40005;
    private static readonly CODIGO_MOTOR = 40070;
    private static readonly CODIGO_MARCA = 45010;
    private static readonly CODIGO_MODELO = 45020;
    private static readonly CODIGO_ANIO = 40004;
    private static readonly CODIGO_TIPO_VEHICULO = 40035;
    private static readonly CODIGO_USO_VEHICULO = 40080;

    /**
     * Construye un vehículo a partir de los datos interpretados
     * correspondientes a un certificado.
     *
     * Para cada atributo se utiliza primero la descripción obtenida
     * mediante `/tablas`, cuando existe. En caso contrario se conserva
     * el valor original informado en `/productos-datos`.
     *
     * @param datos Datos interpretados correspondientes al certificado.
     * @returns Información estructurada del vehículo.
     */
    mapear(datos: FedPatProductoDatoMapeado[]): FedPatVehiculo {

        return { 
            patente: this.obtenerValor(datos, FedPatVehiculoMapper.CODIGO_PATENTE),
            chasis: this.obtenerValor(datos, FedPatVehiculoMapper.CODIGO_CHASIS),
            motor: this.obtenerValor(datos, FedPatVehiculoMapper.CODIGO_MOTOR),
            marca: this.obtenerValor(datos, FedPatVehiculoMapper.CODIGO_MARCA),
            modelo: this.obtenerValor(datos, FedPatVehiculoMapper.CODIGO_MODELO),
            anio: this.obtenerNumero(datos, FedPatVehiculoMapper.CODIGO_ANIO),
            tipoVehiculo: this.obtenerValor(datos, FedPatVehiculoMapper.CODIGO_TIPO_VEHICULO),
            usoVehiculo: this.obtenerValor(datos, FedPatVehiculoMapper.CODIGO_USO_VEHICULO)
        };
    }

    /**
     * Busca un dato mediante su código numérico y devuelve su valor
     * interpretado cuando existe una descripción en `/tablas`.
     *
     * Para valores libres como patente, chasis o número de motor,
     * se utiliza directamente `valorOriginal`.
     */
    private obtenerValor(datos: FedPatProductoDatoMapeado[], codigo: number): string | null {

        const dato = datos.find(item => item.codigoNumerico === codigo);

        if (!dato) {
            return null;
        }

        const valor = dato.valorDescripcion ?? dato.valorOriginal;

        /*
         * Algunos valores provenientes de la API pueden contener
         * espacios adicionales. Los normalizamos únicamente en los
         * extremos sin modificar el contenido interno.
         */
        const valorNormalizado = String(valor).trim();

        if (valorNormalizado.length === 0 || valorNormalizado.toLowerCase() === "null") {
            return null;
        }

        return valorNormalizado;
    }

    /**
     * Obtiene un atributo numérico a partir de un dato del vehículo.
     *
     * Si el dato no existe o no puede convertirse de forma segura
     * a número, devuelve null.
     */
    private obtenerNumero(datos: FedPatProductoDatoMapeado[], codigo: number): number | null {

        const valor = this.obtenerValor(datos, codigo);

        if (valor === null) {
            return null;
        }

        const numero = Number(valor);

        return Number.isFinite(numero)
            ? numero
            : null;
    }
}