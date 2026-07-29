    
    /*
        * Parsea una fecha y lanza error si es inválida.
        * No contiene lógica de negocio, solo valida el formato de la fecha.
        * La lógica de negocio sobre las fechas vive en MercantilPolizaManager o donde se necesite.
        * @see MercantilPolizaManager
        * @param fecha Fecha a parsear en formato YYYY-MM-DD.
        * @return La fecha parseada como objeto Date.
        * @throws Error si la fecha es inválida o no se pudo parsear.
    */
    export function parseFecha(fecha: string): Date {
    
        const date = new Date(fecha);
    
        if (isNaN(date.getTime())) {
            throw new Error(`Fecha inválida: ${fecha}`);
        }
    
        return date;
    }

    /**
     * Calcula los días restantes hasta una fecha dada.
     * Si la fecha ya pasó, devuelve un número negativo.
     * Si la fecha es hoy, devuelve 0.
     * Si la fecha es en el futuro, devuelve un número positivo.
     * No contiene lógica de negocio, solo realiza el cálculo de días restantes.
     * La lógica de negocio sobre los días restantes vive en MercantilPolizaManager o donde se necesite.
     * @see MercantilPolizaManager
     * @param fecha Fecha de vencimiento en formato YYYY-MM-DD.
     * @return El número de días restantes hasta la fecha dada.
     * @throws Error si la fecha es inválida o no se pudo calcular los días restantes.
     */
    export function calcularDiasRestantes(fecha: string): number {
    
        const hoy = new Date();
        const vencimiento = new Date(fecha);
    
        const diferencia = vencimiento.getTime() - hoy.getTime();
    
        return Math.ceil(diferencia /(1000 * 60 * 60 * 24));
    }


    /**
     * Convierte Date a formato YYYY-MM-DD.
     * No contiene lógica de negocio, solo formatea la fecha.
     * La lógica de negocio sobre el formato de la fecha vive en MercantilPolizaManager o donde se necesite.
     * @see MercantilPolizaManager
     * @param fecha Fecha a formatear.
     * @return La fecha formateada en formato YYYY-MM-DD.
     * @throws Error si la fecha es inválida o no se pudo formatear.
     
    export function formatearFecha(fecha: Date): string {
    
        const fechaFormateada = fecha.toISOString().split("T")[0];
    
        if (!fechaFormateada) {
            throw new Error("No se pudo formatear la fecha");
        }
    
        return fechaFormateada;
    }*/




    /**
     *  Espera una cantidad de milisegundos antes de continuar la ejecución.
     * @param milisegundos 
     * @returns 
     */
    export function esperar(milisegundos: number): Promise<void> {

            return new Promise(resolve => setTimeout(resolve,milisegundos));
    }  
    
    /**
     *  Obtiene un mensaje de error a partir de un objeto desconocido.
     * @param error  
     * @returns 
     */
    export function obtenerMensajeError(error: unknown): string {
    
        if (error instanceof Error) {
            return error.message;
        }
    
        if (typeof error === "string") {
            return error;
        }
    
        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    /**
         * Genera un arreglo de fechas entre fechaDesde y fechaHasta.
    */
    export function generarRangoFechas(fechaDesde: string,fechaHasta: string): string[] {
    
            const fechas: string[] = [];
    
            const actual = new Date(`${fechaDesde}T00:00:00`);
            const hasta = new Date(`${fechaHasta}T00:00:00`);
    
            while (actual <= hasta) {
                fechas.push(formatearFecha(actual));
                actual.setDate(actual.getDate() + 1);
            }
    
            return fechas;
    }

    /**
     *  Resta una cantidad de días a una fecha en formato YYYY-MM-DD y devuelve la nueva fecha en el mismo formato.
     * @param fecha  
     * @param cantidadDias 
     * @returns 
     */
    export function restarDias(fecha: string, cantidadDias: number): string {
    
        const [anio, mes, dia] = fecha.split("-").map(Number);
    
        if (anio === undefined || mes === undefined || dia === undefined) {
            throw new Error(`Fecha inválida para calcular sincronización: ${fecha}`);
        }
    
        const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
    
        fechaUtc.setUTCDate(fechaUtc.getUTCDate() - cantidadDias);
    
        return fechaUtc.toISOString().slice(0, 10);
    }

    /**
     *  Convierte Date o string a formato YYYY-MM-DD.
     * @param fecha 
     * @returns  
     */
    export function formatearFecha(fecha: Date | string | undefined): string {

        if (!fecha) {
            return "";
        }
    
        const fechaNormalizada = fecha instanceof Date ? fecha : new Date(fecha);
    
        if (Number.isNaN(fechaNormalizada.getTime())) {
            return String(fecha);
        }
    
        return fechaNormalizada.toISOString().substring(0, 10);
    }


    /**
     *  Convierte una duración en milisegundos a un formato legible de horas, minutos y segundos.
     * @param duracionMs 
     * @returns 
     */
    export function formatearDuracion(duracionMs: number): string {
    
        const segundosTotales = Math.floor(duracionMs / 1000);
    
        const horas = Math.floor(segundosTotales / 3600);
        const minutos = Math.floor((segundosTotales % 3600) / 60); 
        const segundos = segundosTotales % 60;
    
        if (horas > 0) {
            return `${horas}h ${minutos}m ${segundos}s`;
        }
    
        return `${minutos}m ${segundos}s`;
    }
    
 