    
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
     */
    export function formatearFecha(fecha: Date): string {
    
        const fechaFormateada = fecha.toISOString().split("T")[0];
    
        if (!fechaFormateada) {
            throw new Error("No se pudo formatear la fecha");
        }
    
        return fechaFormateada;
    }