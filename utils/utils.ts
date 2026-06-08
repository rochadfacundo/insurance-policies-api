    
    /*
        * Parsea una fecha y lanza error si es inválida.
    */
    export function parseFecha(fecha: string): Date {
    
        const date = new Date(fecha);
    
        if (isNaN(date.getTime())) {
            throw new Error(`Fecha inválida: ${fecha}`);
        }
    
        return date;
    }


    /**
     * Convierte Date a formato YYYY-MM-DD.
     */
    export function formatearFecha(fecha: Date): string {
    
        const fechaFormateada = fecha.toISOString().split("T")[0];
    
        if (!fechaFormateada) {
            throw new Error("No se pudo formatear la fecha");
        }
    
        return fechaFormateada;
    }