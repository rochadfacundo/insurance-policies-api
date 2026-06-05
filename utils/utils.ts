    
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