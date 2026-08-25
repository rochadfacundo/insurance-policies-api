import { MercantilDetallePoliza }
from "./mercantilDetallePoliza";
/*
    * Clase que maneja el detalle de una póliza de Mercantil.
    * Contiene métodos para acceder a los datos del detalle de la póliza y realizar operaciones relacionadas.
    * No contiene lógica de negocio, solo delega la consulta a los métodos correspondientes.
    * La lógica de negocio sobre el detalle de la póliza vive en MercantilDetallePolizaManager.
*/
export class MercantilDetallePolizaManager {

    constructor(
        private readonly detalle:MercantilDetallePoliza,
        ) 
    {}

    /*
        * Devuelve el número de póliza.
        * Útil para identificar la póliza en consultas o reportes.
        * @return El número de póliza.
    */
    getPoliza(): number {
        return this.detalle.poliza;
    }

    /**
     * Devuelve el modelo original.
     */
    getModel(): MercantilDetallePoliza {
        return this.detalle;
    }



    /*
        * Devuelve el número de endoso de la póliza.
        * Útil para identificar la versión específica de la póliza.
        * @return El número de endoso.
    */
    getEndoso(): number {
        return this.detalle.endoso;
    }

    /*
        * Devuelve la fecha de inicio de la póliza.
        * Útil para determinar el período de cobertura de la póliza.
        * @return La fecha de inicio en formato YYYY-MM-DD.
    */
    getCobertura(): string {
        return this.detalle.cobertura;
    }


    /*        
        * Devuelve el bien asegurado de la póliza.
        * Útil para mostrar el bien asegurado en interfaces de usuario o reportes.
        * @return El bien asegurado.
    */
    getBien(): string {
        return this.detalle.bien;
    }

    /*  
        * Devuelve la suma asegurada de la póliza.
        * Útil para determinar el nivel de cobertura de la póliza.
        * @return La suma asegurada.
    */
    getSumaAsegurada(): number {
        return this.detalle.suma;
    }

    /*
        * Devuelve el premio total de la póliza.
        * Útil para determinar el costo total de la póliza.
        * @return El premio total.
    */
    getPremio(): number {
        return this.detalle.costo.premio;
    }

    /**
     * Obtiene el tipo de movimiento correspondiente al detalle de la póliza.
     *
     * Mercantil utiliza este campo para distinguir, entre otros, la emisión
     * inicial ("NUEVA"), los movimientos de facturación ("FACTURACION") y
     * los endosos que modifican la póliza ("ENDOSO").
     *
     * @returns Tipo de movimiento informado por Mercantil.
     */
    getTipo(): string {
        return this.detalle.tipo;
    }

    /*
        * Devuelve la prima total de la póliza.
        * Útil para determinar el costo total de la póliza.
        * @return La prima total.
    */
    getPrima(): number {
        return this.detalle.costo.prima;
    }

    /*
        * Devuelve la prima de responsabilidad civil (RC) de la póliza.
        * Útil para determinar el costo específico de la cobertura de RC.
        * @return La prima de RC.
    */
    getPrimaRC(): number {
        return this.detalle.costo.primaRC;
    }

    /*
        * Devuelve la prima de casco de la póliza.
        * Útil para determinar el costo específico de la cobertura de casco.
        * @return La prima de casco.
    */
    getPrimaCasco(): number {
        return this.detalle.costo.primaCasco;
    }

    /*
        * Devuelve la cantidad de cuotas de la póliza.
        * Útil para determinar el número de pagos que se deben realizar.
        * @return La cantidad de cuotas.
    */
    getCantidadCuotas(): number {
        return this.detalle.cuotas;
    }

    /*
        * Devuelve el nombre del productor asociado a la póliza.
        * Útil para mostrar el nombre del productor en interfaces de usuario o reportes.
        * @return El nombre del productor.
    */
    getNombreProductor(): string {
        return this.detalle.productor.nombre;
    }

    /*
        * Devuelve el código del productor asociado a la póliza.
        * Útil para identificar al productor responsable de la póliza.
        * @return El código del productor.
    */
    getCodigoProductor(): number {
        return this.detalle.productor.id;
    }

    /*
        * Verifica si la prima de la póliza es mayor o igual a un valor mínimo.
        * Útil para determinar si la póliza tiene un costo significativo.
        * @param primaMinima El valor mínimo de prima para considerar que la póliza es de alto riesgo.
        * @return true si la prima es mayor o igual a primaMinima, false en caso contrario.
    */
    esRiesgoMayor(primaMinima: number = 5000000): boolean {
        return this.getPrima()  >= primaMinima;
    }

    /*
        * Verifica si la suma asegurada de la póliza es mayor o igual a un valor mínimo.
        * Útil para determinar si la póliza cumple con ciertos requisitos de cobertura.
        * @param sumaMinima El valor mínimo de suma asegurada para considerar que la póliza es adecuada.
        * @return true si la suma asegurada es mayor o igual a sumaMinima, false en caso contrario.
    */
    esSumaAseguradaMayorA(sumaMinima: number): boolean {
        return this.getSumaAsegurada() >= sumaMinima;
    }

    /*
        * Devuelve un resumen de la póliza con los datos más relevantes.
        * Útil para mostrar en listados o resúmenes.
        * No contiene lógica de negocio, solo delega la consulta a los métodos correspondientes.
        * La lógica de negocio sobre los detalles de la póliza vive en MercantilDetallePolizaManager.
        * @return Un objeto con los datos más relevantes de la póliza.
    */
    getResumen() {

        return {

            poliza: this.getPoliza(),

            productor: this.getCodigoProductor(),

            nombreProductor: this.getNombreProductor(),

            cobertura: this.getCobertura(),

            sumaAsegurada: this.getSumaAsegurada(),

            premio: this.getPremio(),

            prima: this.getPrima(),

            primaRC: this.getPrimaRC(),

            primaCasco: this.getPrimaCasco(),

            cuotas: this.getCantidadCuotas()
        };
    }


    getRamaNombre(): string {
        return this.detalle.rama.nombre;
    }

    getRamaId(): number {
        return this.detalle.rama.id;
    }

    /**
     * Calcula el factor necesario para anualizar los importes
     * correspondientes al período de facturación del detalle.
     *
     * Mercantil puede devolver facturaciones mensuales, trimestrales,
     * semestrales o anuales. Por este motivo no se debe asumir
     * un multiplicador fijo de 12.
     *
     * El factor se obtiene a partir de la duración entre las fechas
     * "desde" y "hasta" informadas por el detalle.
     *
     * Ejemplos aproximados:
     *
     * 1 mes   -> factor 12
     * 3 meses -> factor 4
     * 6 meses -> factor 2
     * 12 meses -> factor 1
     *
     * @returns Factor utilizado para anualizar prima y premio.
     */
    getFactorAnualizacion(): number {

        const desde = new Date(this.detalle.desde);
        const hasta = new Date(this.detalle.hasta);
    
        const meses =
            (hasta.getFullYear() - desde.getFullYear()) * 12 +
            (hasta.getMonth() - desde.getMonth());
    
        if (meses <= 0) {
            return 1;
        }
    
        return 12 / meses;
    }


    /**
     * Obtiene la prima anualizada tomando como base la prima
     * correspondiente al período de facturación informado
     * por Mercantil.
     *
     * @returns Prima anualizada.
     */
    getPrimaAnualizada(): number {

        const prima = this.getPrima();

        return prima * this.getFactorAnualizacion();
    }


    /**
     * Obtiene el premio anualizado tomando como base el premio
     * correspondiente al período de facturación informado
     * por Mercantil.
     *
     * @returns Premio anualizado.
     */
    getPremioAnualizado(): number {

        const premio = this.getPremio();

        return premio * this.getFactorAnualizacion();
    }


}