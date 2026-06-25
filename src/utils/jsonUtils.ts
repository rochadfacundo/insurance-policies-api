import fs from "fs";

/*
    * Guarda un objeto como JSON en un archivo.
    *
    * @param data - El objeto a guardar.
    * @param path - La ruta del archivo donde se guardará el JSON.
    * No contiene lógica de negocio, solo se encarga de guardar el JSON en un archivo.
    * La lógica de negocio sobre qué datos guardar y cómo estructurarlos vive en MercantilPolizaManager o donde se necesite.
    * @throws Error si no se pudo guardar el archivo.
*/
export function guardarJson(data: any[], path: string): void {

    fs.writeFileSync(path,JSON.stringify(data,null,2));
    
    console.log(`Archivo generado: ${path}`);
}