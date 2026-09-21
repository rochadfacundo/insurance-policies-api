import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// El .env está una carpeta arriba de /scripts
dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

interface CertificadoFedPat {
    codigo_ramo: number;
    numero_poliza: number;
    certificado: number;
    tipo_asegurado: string;
    codigo_asegurado: string;
    estado_certificado: number;
    fecha_estado: string;
    fecha_emision: string;
    vigencia_desde: string;
    vigencia_hasta: string;
    renovacion_aumatica: string;
    codigo_productor: number;
    codigo_acreedor: number | null;
    forma_pago: number;
    numero_tarjeta: string | null;
    codigo_tarjeta: string | null;
    tipo_poliza: string;
    moneda: string;
    renovada_por: number | null;
    agencia: number;
    renueva_a: number | null;
    tipo_facturacion: string;
    cant_facturacion: number | null;
}

interface AparicionCertificado {
    fechaConsulta: string;
    certificado: CertificadoFedPat;
}

function generarFechasHaciaAtras(
    fechaFin: Date,
    cantidadDias: number
): string[] {

    const fechas: string[] = [];

    for (let i = cantidadDias - 1; i >= 0; i--) {

        const fecha = new Date(fechaFin);

        fecha.setDate(
            fecha.getDate() - i
        );

        const dia = String(
            fecha.getDate()
        ).padStart(2, "0");

        const mes = String(
            fecha.getMonth() + 1
        ).padStart(2, "0");

        const anio =
            fecha.getFullYear();

        fechas.push(
            `${dia}/${mes}/${anio}`
        );
    }

    return fechas;
}

function obtenerClaveCertificado(
    certificado: CertificadoFedPat
): string {

    return [
        certificado.codigo_ramo,
        certificado.numero_poliza,
        certificado.certificado
    ].join("-");
}

function certificadosIguales(
    a: CertificadoFedPat,
    b: CertificadoFedPat
): boolean {

    return JSON.stringify(a) === JSON.stringify(b);
}

async function main(): Promise<void> {

    console.log("");
    console.log("==================================================");
    console.log("FEDERACIÓN PATRONAL - ANÁLISIS API CARTERA");
    console.log("==================================================");
    console.log("");

    const clientId = process.env.FED_PAT_CLIENT_ID;
    const clientSecret = process.env.FED_PAT_CLIENT_SECRET;
    const username = process.env.FED_PAT_USERNAME;
    const password = process.env.FED_PAT_PASSWORD;

    if (!clientId || !clientSecret || !username || !password) {
        throw new Error(
            "Faltan credenciales de Federación Patronal en el .env"
        );
    }

    console.log(`Client ID: ${clientId}`);
    console.log(`Usuario: ${username}`);
    console.log("Client Secret: cargado");
    console.log("Password: cargado");
    console.log("");

    const tokenUrl =
        "https://api.fedpat.com.ar/oauth/token";

    const baseCarteraUrl =
        "https://api.fedpat.com.ar/v1/cartera";

    const body = new URLSearchParams();

    body.append("grant_type", "password");
    body.append("username", username);
    body.append("password", password);

    try {

        // ==================================================
        // 1. OBTENER TOKEN
        // ==================================================

        console.log("Solicitando token...");

        const tokenResponse = await axios.post(
            tokenUrl,
            body.toString(),
            {
                auth: {
                    username: clientId,
                    password: clientSecret
                },
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );

        const accessToken =
            tokenResponse.data?.access_token;

        if (!accessToken) {
            throw new Error(
                "Federación Patronal no devolvió un access_token"
            );
        }

        console.log("");
        console.log("✅ AUTENTICACIÓN EXITOSA");
        console.log(`Status: ${tokenResponse.status}`);
        console.log(
            `Token type: ${tokenResponse.data?.token_type}`
        );
        console.log(
            `Expires in: ${tokenResponse.data?.expires_in}`
        );
        console.log(
            `Scope: ${tokenResponse.data?.scope}`
        );
        console.log(
            `Token recibido correctamente (${accessToken.length} caracteres).`
        );

        const headers = {
            Authorization: `Bearer ${accessToken}`
        };

        // ==================================================
        // 2. OBTENER PRODUCTORES
        // ==================================================

        console.log("");
        console.log("==================================================");
        console.log("CONSULTANDO PRODUCTORES");
        console.log("==================================================");
        console.log("");

        const productoresResponse = await axios.get(
            `${baseCarteraUrl}/productores`,
            {
                params: {
                    tipo: "O"
                },
                headers
            }
        );

        const productores =
            productoresResponse.data?.productores;

        console.log(
            "✅ CONSULTA DE PRODUCTORES EXITOSA"
        );
        console.log(
            `Status: ${productoresResponse.status}`
        );

        if (Array.isArray(productores)) {

            console.log(
                `Total productores: ${productores.length}`
            );

        } else {

            console.log(
                "⚠️ La respuesta no contiene un array 'productores'."
            );
        }

        // ==================================================
        // 3. CONSULTAR CERTIFICADOS DE VARIAS FECHAS
        // ==================================================

        const fechasConsulta = [
            "17/09/2026",
            "18/09/2026",
            "19/09/2026",
            "20/09/2026"
        ];

        const certificadosPorFecha =
            new Map<string, CertificadoFedPat[]>();

        console.log("");
        console.log("==================================================");
        console.log("CONSULTANDO CERTIFICADOS");
        console.log("==================================================");

        for (const fecha of fechasConsulta) {

            console.log("");
            console.log("------------------------------------------");
            console.log(`Fecha: ${fecha}`);
            console.log("------------------------------------------");

            const response = await axios.get(
                `${baseCarteraUrl}/certificados`,
                {
                    params: {
                        fecha,
                        tipo: "O"
                    },
                    headers
                }
            );

            const certificados =
                response.data?.certificados;

            if (!Array.isArray(certificados)) {

                console.log(
                    `⚠️ ${fecha}: no se recibió un array de certificados.`
                );

                certificadosPorFecha.set(
                    fecha,
                    []
                );

                continue;
            }

            certificadosPorFecha.set(
                fecha,
                certificados
            );

            console.log(
                `✅ ${fecha}: ${certificados.length} certificados`
            );
        }

        // ==================================================
        // 4. RESUMEN
        // ==================================================

        console.log("");
        console.log("==================================================");
        console.log("RESUMEN POR FECHA");
        console.log("==================================================");
        console.log("");

        let totalRegistros = 0;

        for (
            const [fecha, certificados]
            of certificadosPorFecha
        ) {

            console.log(
                `${fecha}: ${certificados.length} certificados`
            );

            totalRegistros += certificados.length;
        }

        console.log("");
        console.log(
            `TOTAL REGISTROS RECIBIDOS: ${totalRegistros}`
        );

        // ==================================================
        // 5. AGRUPAR POR CLAVE NATURAL
        // ==================================================

        const apariciones =
            new Map<string, AparicionCertificado[]>();

        for (
            const [fecha, certificados]
            of certificadosPorFecha
        ) {

            for (const certificado of certificados) {

                const clave =
                    obtenerClaveCertificado(certificado);

                const existentes =
                    apariciones.get(clave) ?? [];

                existentes.push({
                    fechaConsulta: fecha,
                    certificado
                });

                apariciones.set(
                    clave,
                    existentes
                );
            }
        }

        const certificadosUnicos =
            apariciones.size;

        const repetidos =
            [...apariciones.entries()]
                .filter(
                    ([, registros]) =>
                        registros.length > 1
                );

        console.log("");
        console.log("==================================================");
        console.log("ANÁLISIS DE CLAVES");
        console.log("==================================================");
        console.log("");

        console.log(
            `Registros recibidos: ${totalRegistros}`
        );

        console.log(
            `Certificados únicos: ${certificadosUnicos}`
        );

        console.log(
            `Certificados presentes más de una vez: ${repetidos.length}`
        );

        // ==================================================
        // 6. ANALIZAR REPETIDOS
        // ==================================================

        if (repetidos.length === 0) {

            console.log("");
            console.log(
                "✅ No se encontraron certificados repetidos entre las fechas."
            );

        } else {

            console.log("");
            console.log("==================================================");
            console.log("CERTIFICADOS REPETIDOS");
            console.log("==================================================");

            for (
                const [clave, registros]
                of repetidos
            ) {

                if(registros[0] == undefined || registros == undefined || registros[0].certificado == undefined) {
                    continue;
                }

                console.log("");
                console.log("------------------------------------------");
                console.log(`CLAVE: ${clave}`);
                console.log("------------------------------------------");

                console.log(
                    `Apariciones: ${registros.length}`
                );

                console.log(
                    `Fechas: ${registros
                        .map(r => r.fechaConsulta)
                        .join(", ")}`
                );

                const primerRegistro = registros[0];

                if (!primerRegistro) {
                    continue;
                }

                const todosIguales =
                    registros.every(
                        registro =>
                            certificadosIguales(
                                primerRegistro.certificado,
                                registro.certificado
                            )
                    );

                if (todosIguales) {

                    console.log(
                        "Contenido: IGUAL en todas las apariciones"
                    );

                } else {

                    console.log(
                        "⚠️ Contenido: CAMBIÓ entre apariciones"
                    );
                }

                for (const registro of registros) {

                    console.log("");
                    console.log(
                        `Fecha consulta: ${registro.fechaConsulta}`
                    );

                    console.dir(
                        registro.certificado,
                        {
                            depth: null,
                            colors: true
                        }
                    );
                }
            }
        }

        // ==================================================
        // 7. RESUMEN FINAL DE REPETICIONES
        // ==================================================

        const repetidosSinCambios =
            repetidos.filter(([, registros]) => {

                const primero = registros[0];

                if (!primero) {
                    return false;
                }

                return registros.every(
                    registro =>
                        certificadosIguales(
                            primero.certificado,
                            registro.certificado
                        )
                );
            });

        const repetidosConCambios =
            repetidos.filter(([, registros]) => {
        
                const primero = registros[0];
        
                if (!primero) {
                    return false;
                }
        
                return !registros.every(
                    registro =>
                        certificadosIguales(
                            primero.certificado,
                            registro.certificado
                        )
                );
            });

        console.log("");
        console.log("==================================================");
        console.log("RESULTADO FINAL");
        console.log("==================================================");
        console.log("");

        console.log(
            `Total registros: ${totalRegistros}`
        );

        console.log(
            `Claves únicas: ${certificadosUnicos}`
        );

        console.log(
            `Claves repetidas: ${repetidos.length}`
        );

        console.log(
            `Repetidos sin cambios: ${repetidosSinCambios.length}`
        );

        console.log(
            `Repetidos con cambios: ${repetidosConCambios.length}`
        );

        // ==================================================
// 8. CONSULTAR RIESGOS CUBIERTOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("CONSULTANDO RIESGOS CUBIERTOS");
console.log("==================================================");
console.log("");

const fechaPrueba = "18/09/2026";

const riesgosResponse = await axios.get(
    `${baseCarteraUrl}/riesgos-cubiertos`,
    {
        params: {
            fecha: fechaPrueba,
            tipo: "O"
        },
        headers
    }
);

const riesgosCubiertos =
    riesgosResponse.data?.riesgos_cubiertos;

console.log("✅ CONSULTA DE RIESGOS CUBIERTOS EXITOSA");
console.log(`Status: ${riesgosResponse.status}`);
console.log(
    `Fecha solicitada: ${riesgosResponse.data?.fecha_solicitada}`
);

if (Array.isArray(riesgosCubiertos)) {

    console.log(
        `Total riesgos cubiertos: ${riesgosCubiertos.length}`
    );

    console.log("");
    console.log("PRIMEROS 10 RIESGOS CUBIERTOS:");

    console.dir(
        riesgosCubiertos.slice(0, 10),
        {
            depth: null,
            colors: true
        }
    );

} else {

    console.log(
        "⚠️ La respuesta no contiene un array 'riesgos_cubiertos'."
    );

    console.dir(
        riesgosResponse.data,
        {
            depth: null,
            colors: true
        }
    );
}


// ==================================================
// 9. CONSULTAR SUMAS DE CERTIFICADOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("CONSULTANDO SUMAS DE CERTIFICADOS");
console.log("==================================================");
console.log("");

const sumasResponse = await axios.get(
    `${baseCarteraUrl}/certificados-sumas`,
    {
        params: {
            fecha: fechaPrueba,
            tipo: "O"
        },
        headers
    }
);

const certificadosSumas =
    sumasResponse.data?.certificados_sumas;

console.log("✅ CONSULTA DE SUMAS EXITOSA");
console.log(`Status: ${sumasResponse.status}`);
console.log(
    `Fecha solicitada: ${sumasResponse.data?.fecha_solicitada}`
);

if (Array.isArray(certificadosSumas)) {

    console.log(
        `Total sumas: ${certificadosSumas.length}`
    );

    console.log("");
    console.log("PRIMERAS 10 SUMAS:");

    console.dir(
        certificadosSumas.slice(0, 10),
        {
            depth: null,
            colors: true
        }
    );

} else {

    console.log(
        "⚠️ La respuesta no contiene un array 'certificados_sumas'."
    );

    console.dir(
        sumasResponse.data,
        {
            depth: null,
            colors: true
        }
    );
}

// ==================================================
// CONSULTAR PRODUCTOS-DATOS DE LOS ÚLTIMOS 30 DÍAS
// ==================================================

const fechasProductosDatos =
    generarFechasHaciaAtras(
        new Date(2026, 8, 20),
        30
    );

console.log("");
console.log("==================================================");
console.log("CONSULTANDO DATOS DE PRODUCTOS - 30 DÍAS");
console.log("==================================================");

console.log("");
console.log(
    `Desde: ${fechasProductosDatos[0]}`
);

console.log(
    `Hasta: ${fechasProductosDatos[fechasProductosDatos.length - 1]}`
);

const todosProductosDatos: any[] = [];

for (const fecha of fechasProductosDatos) {

    console.log("");
    console.log(`Consultando productos-datos: ${fecha}`);

    const response = await axios.get(
        `${baseCarteraUrl}/productos-datos`,
        {
            params: {
                fecha,
                tipo: "O"
            },
            headers
        }
    );

    const productos =
        response.data?.producto_datos;

    if (!Array.isArray(productos)) {

        console.log(
            `⚠️ ${fecha}: respuesta sin array producto_datos`
        );

        continue;
    }

    console.log(
        `✅ ${fecha}: ${productos.length} registros`
    );

    for (const producto of productos) {

        todosProductosDatos.push({
            fechaConsulta: fecha,
            ...producto
        });
    }
}

console.log("");
console.log(
    `TOTAL PRODUCTOS-DATOS RECIBIDOS: ${todosProductosDatos.length}`
);


// ==================================================
// ANALIZAR POSIBLES FLOTAS DE AUTOMOTORES
// ==================================================

console.log("");
console.log("==================================================");
console.log("ANALIZANDO POSIBLES FLOTAS DE AUTOMOTORES");
console.log("==================================================");
console.log("");

const RAMO_AUTOMOTORES = 4;

const CODIGO_PATENTE = "C40006";
const CODIGO_CHASIS = "C40005";

const datosAutomotores =
    todosProductosDatos.filter(
        dato => dato.codigo_ramo === RAMO_AUTOMOTORES
    );

// Agrupamos TODOS los datos por número de póliza.
const polizasAutomotores = new Map<number, any[]>();

for (const dato of datosAutomotores) {

    if (!polizasAutomotores.has(dato.numero_poliza)) {
        polizasAutomotores.set(
            dato.numero_poliza,
            []
        );
    }

    polizasAutomotores
        .get(dato.numero_poliza)!
        .push(dato);
}

console.log(
    `Pólizas de automotores distintas: ${polizasAutomotores.size}`
);


// ==================================================
// BUSCAR PÓLIZAS CON MÚLTIPLES CERTIFICADOS / VEHÍCULOS
// ==================================================

const posiblesFlotas: {
    numeroPoliza: number;
    certificados: number[];
    patentes: string[];
    chasis: string[];
    datos: any[];
}[] = [];

for (const [numeroPoliza, datos] of polizasAutomotores) {

    const certificados = [
        ...new Set<number>(
            datos.map(dato => dato.certificado)
        )
    ].sort((a, b) => a - b);

    const patentes = [
        ...new Set<string>(
            datos
                .filter(
                    dato =>
                        dato.codigo_dato === CODIGO_PATENTE &&
                        dato.valor_dato
                )
                .map(
                    dato => String(dato.valor_dato)
                )
        )
    ];

    const chasis = [
        ...new Set<string>(
            datos
                .filter(
                    dato =>
                        dato.codigo_dato === CODIGO_CHASIS &&
                        dato.valor_dato
                )
                .map(
                    dato => String(dato.valor_dato)
                )
        )
    ];

    // Consideramos interesante cualquiera de estas situaciones.
    if (
        certificados.length > 1 ||
        patentes.length > 1 ||
        chasis.length > 1
    ) {

        posiblesFlotas.push({
            numeroPoliza,
            certificados,
            patentes,
            chasis,
            datos
        });
    }
}


// ==================================================
// MOSTRAR RESULTADOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("POSIBLES FLOTAS");
console.log("==================================================");
console.log("");

console.log(
    `Pólizas candidatas: ${posiblesFlotas.length}`
);

for (const poliza of posiblesFlotas) {

    console.log("");
    console.log("------------------------------------------");
    console.log(`PÓLIZA: ${poliza.numeroPoliza}`);
    console.log("------------------------------------------");

    console.log(
        `Certificados distintos: ${poliza.certificados.length}`
    );

    console.log(
        `Certificados: ${poliza.certificados.join(", ")}`
    );

    console.log(
        `Patentes distintas: ${poliza.patentes.length}`
    );

    console.log(
        `Patentes: ${poliza.patentes.join(", ") || "NINGUNA"}`
    );

    console.log(
        `Chasis distintos: ${poliza.chasis.length}`
    );

    console.log(
        `Chasis: ${poliza.chasis.join(", ") || "NINGUNO"}`
    );

    const fechas = [
        ...new Set<string>(
            poliza.datos.map(
                dato => dato.fechaConsulta
            )
        )
    ];

    console.log(
        `Fechas donde apareció: ${fechas.join(", ")}`
    );

    // Mostramos patente/chasis por certificado.
    for (const certificado of poliza.certificados) {

        const datosCertificado =
            poliza.datos.filter(
                dato =>
                    dato.certificado === certificado
            );

        const patentesCertificado = [
            ...new Set<string>(
                datosCertificado
                    .filter(
                        dato =>
                            dato.codigo_dato === CODIGO_PATENTE &&
                            dato.valor_dato
                    )
                    .map(
                        dato => String(dato.valor_dato)
                    )
            )
        ];

        const chasisCertificado = [
            ...new Set<string>(
                datosCertificado
                    .filter(
                        dato =>
                            dato.codigo_dato === CODIGO_CHASIS &&
                            dato.valor_dato
                    )
                    .map(
                        dato => String(dato.valor_dato)
                    )
            )
        ];

        console.log("");
        console.log(`  Certificado ${certificado}`);

        console.log(
            `    Patentes: ${
                patentesCertificado.join(", ") || "NINGUNA"
            }`
        );

        console.log(
            `    Chasis: ${
                chasisCertificado.join(", ") || "NINGUNO"
            }`
        );
    }
}

// ==================================================
// 11. CONSULTAR COMPONENTES DE CERTIFICADOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("CONSULTANDO COMPONENTES DE CERTIFICADOS");
console.log("==================================================");
console.log("");

const componentesResponse = await axios.get(
    `${baseCarteraUrl}/certificados-componentes`,
    {
        params: {
            fecha: fechaPrueba,
            tipo: "O"
        },
        headers
    }
);

const componentes =
    componentesResponse.data?.componentes;

console.log("✅ CONSULTA DE COMPONENTES EXITOSA");
console.log(`Status: ${componentesResponse.status}`);
console.log(
    `Fecha solicitada: ${componentesResponse.data?.fecha_solicitada}`
);

if (Array.isArray(componentes)) {

    console.log(
        `Total componentes: ${componentes.length}`
    );

    console.log("");
    console.log("PRIMEROS 10 COMPONENTES:");

    console.dir(
        componentes.slice(0, 10),
        {
            depth: null,
            colors: true
        }
    );

} else {

    console.log(
        "⚠️ La respuesta no contiene un array 'componentes'."
    );

    console.dir(
        componentesResponse.data,
        {
            depth: null,
            colors: true
        }
    );
}

// ==================================================
// 12. CONSULTAR CATÁLOGO DE DATOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("CONSULTANDO CATÁLOGO DE DATOS");
console.log("==================================================");
console.log("");

const datosResponse = await axios.get(
    `${baseCarteraUrl}/datos`,
    {
        headers
    }
);

const datos = datosResponse.data;

console.log("✅ CONSULTA DE DATOS EXITOSA");
console.log(`Status: ${datosResponse.status}`);

if (Array.isArray(datos)) {

    console.log(`Total datos: ${datos.length}`);

    // Nos interesan particularmente los códigos
    // que encontramos en productos-datos.
    const codigosInteres = [
        40001,
        40005,
        40006,
        40035,
        45010,
        45020,
        45050,
        46040,
        46050,
        46065,
        46250,
        81005
    ];

    
    const datosInteres = datos.filter(
        dato => codigosInteres.includes(Number(dato.codigo))
    );

    console.log("");
    console.log("DATOS DE INTERÉS:");

    console.dir(
        datosInteres,
        {
            depth: null,
            colors: true
        }
    );

    console.log("");
    console.log("PRIMEROS 20 DATOS:");

    console.dir(
        datos.slice(0, 20),
        {
            depth: null,
            colors: true
        }
    );
}


// ==================================================
// 13. CONSULTAR RAMOS DE PÓLIZAS
// ==================================================

console.log("");
console.log("==================================================");
console.log("CONSULTANDO RAMOS DE PÓLIZAS");
console.log("==================================================");
console.log("");

const ramosResponse = await axios.get(
    `${baseCarteraUrl}/ramos-polizas`,
    {
        headers
    }
);

const ramos = ramosResponse.data;

console.log("✅ CONSULTA DE RAMOS EXITOSA");
console.log(`Status: ${ramosResponse.status}`);

if (Array.isArray(ramos)) {

    console.log(`Total ramos: ${ramos.length}`);

    const ramosInteres = ramos.filter(
        ramo =>
            ["4", "8", "12", "17", "19", "35", "44"]
                .includes(String(ramo.codigo))
    );

    console.log("");
    console.log("RAMOS QUE ENCONTRAMOS EN LAS PRUEBAS:");

    console.dir(
        ramosInteres,
        {
            depth: null,
            colors: true
        }
    );
}


// ==================================================
// 14. CONSULTAR MOTIVOS DE ENDOSO
// ==================================================

console.log("");
console.log("==================================================");
console.log("CONSULTANDO MOTIVOS DE ENDOSO");
console.log("==================================================");
console.log("");

const motivosResponse = await axios.get(
    `${baseCarteraUrl}/motivos-endoso`,
    {
        headers
    }
);

const motivosEndoso = motivosResponse.data;

console.log("✅ CONSULTA DE MOTIVOS DE ENDOSO EXITOSA");
console.log(`Status: ${motivosResponse.status}`);

if (Array.isArray(motivosEndoso)) {

    console.log(
        `Total motivos de endoso: ${motivosEndoso.length}`
    );

    console.log("");
    console.log("MOTIVOS DE ENDOSO:");

    console.dir(
        motivosEndoso,
        {
            depth: null,
            colors: true
        }
    );
}


// ==================================================
// 15. CONSULTAR TABLAS
// ==================================================

console.log("");
console.log("==================================================");
console.log("CONSULTANDO TABLAS");
console.log("==================================================");
console.log("");

const tablasResponse = await axios.get(
    `${baseCarteraUrl}/tablas`,
    {
        params: {
            fecha: fechaPrueba,
            tipo: "O"
        },
        headers
    }
);

const tablas =
    tablasResponse.data?.tablas;

console.log("✅ CONSULTA DE TABLAS EXITOSA");
console.log(`Status: ${tablasResponse.status}`);
console.log(
    `Fecha solicitada: ${tablasResponse.data?.fecha_solicitada}`
);

if (Array.isArray(tablas)) {

    console.log(
        `Total registros de tablas: ${tablas.length}`
    );

    console.log("");
    console.log("PRIMEROS 30 REGISTROS:");

    console.dir(
        tablas.slice(0, 30),
        {
            depth: null,
            colors: true
        }
    );
}
// ==================================================
// 16. ANALIZAR ENDOSOS DE LA PÓLIZA FLOTA ENCONTRADA
// ==================================================

console.log("");
console.log("==================================================");
console.log("ANALIZANDO ENDOSOS DE PÓLIZA 35274952");
console.log("==================================================");

const POLIZA_FLOTA_PRUEBA = 35274952;

const fechasFlotaPrueba = [
    "10/09/2026",
    "15/09/2026"
];

const endososPolizaFlota: any[] = [];

for (const fecha of fechasFlotaPrueba) {

    console.log("");
    console.log(`Consultando certificados-endosos: ${fecha}`);

    const response = await axios.get(
        `${baseCarteraUrl}/certificados-endosos`,
        {
            params: {
                fecha,
                tipo: "O"
            },
            headers
        }
    );

    /*
     * Primero mostramos las claves de la respuesta.
     * Como todavía no probamos este endpoint,
     * quiero confirmar cómo llama Federación al array.
     */
    console.log(
        "Claves respuesta:",
        Object.keys(response.data ?? {})
    );

    const posiblesArrays = Object.entries(
        response.data ?? {}
    ).filter(
        ([, valor]) => Array.isArray(valor)
    );

    console.log(
        "Arrays encontrados:",
        posiblesArrays.map(
            ([clave, valor]) => ({
                clave,
                cantidad: (valor as any[]).length
            })
        )
    );

    for (const [, valor] of posiblesArrays) {

        const registros = valor as any[];

        const registrosPoliza =
            registros.filter(
                registro =>
                    registro.numero_poliza ===
                    POLIZA_FLOTA_PRUEBA
            );

        for (const registro of registrosPoliza) {

            endososPolizaFlota.push({
                fechaConsulta: fecha,
                ...registro
            });
        }
    }
}


// ==================================================
// MOSTRAR ENDOSOS ENCONTRADOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("ENDOSOS DE LA PÓLIZA 35274952");
console.log("==================================================");
console.log("");

console.log(
    `Total registros encontrados: ${endososPolizaFlota.length}`
);

if (endososPolizaFlota.length === 0) {

    console.log(
        "⚠️ No se encontraron endosos para la póliza."
    );

} else {

    console.dir(
        endososPolizaFlota,
        {
            depth: null,
            colors: true
        }
    );
}

// ==================================================
// 17. ANALIZAR CERTIFICADOS DE LA PÓLIZA FLOTA
// ==================================================

console.log("");
console.log("==================================================");
console.log("ANALIZANDO CERTIFICADOS DE PÓLIZA 35274952");
console.log("==================================================");

const certificadosPolizaFlota: any[] = [];

for (const fecha of fechasFlotaPrueba) {

    console.log("");
    console.log(`Consultando certificados: ${fecha}`);

    const response = await axios.get(
        `${baseCarteraUrl}/certificados`,
        {
            params: {
                fecha,
                tipo: "O"
            },
            headers
        }
    );

    const certificados =
        response.data?.certificados;

    if (!Array.isArray(certificados)) {

        console.log(
            `⚠️ ${fecha}: respuesta sin array certificados`
        );

        continue;
    }

    console.log(
        `Total certificados recibidos: ${certificados.length}`
    );

    const certificadosFlota =
        certificados.filter(
            certificado =>
                certificado.numero_poliza ===
                POLIZA_FLOTA_PRUEBA
        );

    console.log(
        `Certificados encontrados para póliza ${POLIZA_FLOTA_PRUEBA}: ${certificadosFlota.length}`
    );

    for (const certificado of certificadosFlota) {

        certificadosPolizaFlota.push({
            fechaConsulta: fecha,
            ...certificado
        });
    }
}


// ==================================================
// MOSTRAR CERTIFICADOS ENCONTRADOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("CERTIFICADOS DE LA PÓLIZA 35274952");
console.log("==================================================");
console.log("");

console.log(
    `Total registros encontrados: ${certificadosPolizaFlota.length}`
);

console.dir(
    certificadosPolizaFlota,
    {
        depth: null,
        colors: true
    }
);

// ==================================================
// 18. ANALIZAR ESTADOS Y RENOVACIONES - 30 DÍAS
// ==================================================

console.log("");
console.log("==================================================");
console.log("ANALIZANDO ESTADOS Y RENOVACIONES - 30 DÍAS");
console.log("==================================================");

const todosCertificados30Dias: any[] = [];

for (const fecha of fechasProductosDatos) {

    console.log("");
    console.log(`Consultando certificados: ${fecha}`);

    const response = await axios.get(
        `${baseCarteraUrl}/certificados`,
        {
            params: {
                fecha,
                tipo: "O"
            },
            headers
        }
    );

    const certificados =
        response.data?.certificados;

    if (!Array.isArray(certificados)) {

        console.log(
            `⚠️ ${fecha}: respuesta sin array certificados`
        );

        continue;
    }

    console.log(
        `✅ ${fecha}: ${certificados.length} certificados`
    );

    for (const certificado of certificados) {

        todosCertificados30Dias.push({
            fechaConsulta: fecha,
            ...certificado
        });
    }
}


// ==================================================
// ANALIZAR ESTADOS
// ==================================================

console.log("");
console.log("==================================================");
console.log("ESTADOS DE CERTIFICADOS");
console.log("==================================================");

const certificadosPorEstado =
    new Map<number, any[]>();

for (const certificado of todosCertificados30Dias) {

    const estado =
        certificado.estado_certificado;

    const existentes =
        certificadosPorEstado.get(estado) ?? [];

    existentes.push(certificado);

    certificadosPorEstado.set(
        estado,
        existentes
    );
}

console.log("");
console.log(
    `Total certificados recibidos: ${todosCertificados30Dias.length}`
);

console.log(
    `Estados distintos encontrados: ${certificadosPorEstado.size}`
);

for (
    const [estado, certificados]
    of certificadosPorEstado
) {

    console.log("");
    console.log("------------------------------------------");
    console.log(`ESTADO: ${estado}`);
    console.log("------------------------------------------");

    console.log(
        `Cantidad: ${certificados.length}`
    );

    console.log("");
    console.log("Primeros 5 ejemplos:");

    console.dir(
        certificados
            .slice(0, 5)
            .map(certificado => ({
                fechaConsulta:
                    certificado.fechaConsulta,

                codigo_ramo:
                    certificado.codigo_ramo,

                numero_poliza:
                    certificado.numero_poliza,

                certificado:
                    certificado.certificado,

                estado_certificado:
                    certificado.estado_certificado,

                fecha_estado:
                    certificado.fecha_estado,

                vigencia_desde:
                    certificado.vigencia_desde,

                vigencia_hasta:
                    certificado.vigencia_hasta,

                renovacion_aumatica:
                    certificado.renovacion_aumatica,

                renovada_por:
                    certificado.renovada_por,

                renueva_a:
                    certificado.renueva_a
            })),
        {
            depth: null,
            colors: true
        }
    );
}


// ==================================================
// ANALIZAR RELACIONES DE RENOVACIÓN
// ==================================================

console.log("");
console.log("==================================================");
console.log("ANALIZANDO RENOVACIONES");
console.log("==================================================");

const conRenuevaA =
    todosCertificados30Dias.filter(
        certificado =>
            certificado.renueva_a !== null &&
            certificado.renueva_a !== undefined &&
            certificado.renueva_a !== 0
    );

const conRenovadaPor =
    todosCertificados30Dias.filter(
        certificado =>
            certificado.renovada_por !== null &&
            certificado.renovada_por !== undefined &&
            certificado.renovada_por !== 0
    );

console.log("");
console.log(
    `Registros con renueva_a: ${conRenuevaA.length}`
);

console.log(
    `Registros con renovada_por: ${conRenovadaPor.length}`
);


// ==================================================
// MOSTRAR EJEMPLOS DE RENUEVA_A
// ==================================================

console.log("");
console.log("EJEMPLOS CON renueva_a:");

console.dir(
    conRenuevaA
        .slice(0, 10)
        .map(certificado => ({
            fechaConsulta:
                certificado.fechaConsulta,

            codigo_ramo:
                certificado.codigo_ramo,

            numero_poliza:
                certificado.numero_poliza,

            certificado:
                certificado.certificado,

            vigencia_desde:
                certificado.vigencia_desde,

            vigencia_hasta:
                certificado.vigencia_hasta,

            renovada_por:
                certificado.renovada_por,

            renueva_a:
                certificado.renueva_a
        })),
    {
        depth: null,
        colors: true
    }
);


// ==================================================
// MOSTRAR EJEMPLOS DE RENOVADA_POR
// ==================================================

console.log("");
console.log("EJEMPLOS CON renovada_por:");

console.dir(
    conRenovadaPor
        .slice(0, 10)
        .map(certificado => ({
            fechaConsulta:
                certificado.fechaConsulta,

            codigo_ramo:
                certificado.codigo_ramo,

            numero_poliza:
                certificado.numero_poliza,

            certificado:
                certificado.certificado,

            vigencia_desde:
                certificado.vigencia_desde,

            vigencia_hasta:
                certificado.vigencia_hasta,

            renovada_por:
                certificado.renovada_por,

            renueva_a:
                certificado.renueva_a
        })),
    {
        depth: null,
        colors: true
    }
);


// ==================================================
// BUSCAR RELACIONES CRUZADAS DE RENOVACIÓN
// ==================================================

console.log("");
console.log("==================================================");
console.log("RELACIONES DE RENOVACIÓN ENCONTRADAS");
console.log("==================================================");

const polizasPresentes =
    new Set<number>(
        todosCertificados30Dias.map(
            certificado =>
                certificado.numero_poliza
        )
    );

const relacionesEncontradas =
    conRenuevaA
        .filter(
            certificado =>
                polizasPresentes.has(
                    certificado.renueva_a
                )
        )
        .map(certificado => ({
            polizaOrigen:
                certificado.numero_poliza,

            renuevaA:
                certificado.renueva_a,

            ramo:
                certificado.codigo_ramo,

            fechaConsulta:
                certificado.fechaConsulta
        }));

console.log(
    `Relaciones cruzadas encontradas: ${relacionesEncontradas.length}`
);

console.dir(
    relacionesEncontradas.slice(0, 20),
    {
        depth: null,
        colors: true
    }
);



    } catch (error: unknown) {

        console.error("");
        console.error(
            "❌ ERROR EN FEDERACIÓN PATRONAL"
        );
        console.error("");

        if (axios.isAxiosError(error)) {

            console.error(
                "URL:",
                error.config?.url
            );

            console.error(
                "Params:",
                error.config?.params
            );

            console.error(
                "Status:",
                error.response?.status
            );

            console.error(
                "Status text:",
                error.response?.statusText
            );

            console.error("");
            console.error("Respuesta:");

            console.dir(
                error.response?.data,
                {
                    depth: null,
                    colors: true
                }
            );

        } else {

            console.error(error);
        }

        process.exitCode = 1;
    }
}

main()
    .then(() => {

        console.log("");
        console.log("Prueba finalizada.");

    })
    .catch((error: unknown) => {

        console.error("");
        console.error("Error general:");
        console.error(error);

        process.exitCode = 1;
    });