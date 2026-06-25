import fs from "fs";
import path from "path";
import { Productor } from "../../../models/productor";


export function obtenerProductoresMercantil(): Productor[] {

    const ruta = path.resolve(__dirname,"data","productoresMA.json");

    const contenido = fs.readFileSync(ruta,"utf8");

    console.log(contenido);

    const productores: Productor[] = JSON.parse(contenido);


    return productores;
}