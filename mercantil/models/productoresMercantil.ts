import fs from "fs";
import path from "path";
import { Productor } from "../../models/productor";


export function obtenerProductoresMercantil(): Productor[] {

    const ruta = path.resolve(__dirname,"data","productores.json");

    const contenido = fs.readFileSync(ruta,"utf8");

    console.log(contenido);

    return JSON.parse(contenido);
}