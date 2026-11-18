import { FirebaseConfig } from "../src/config/firebaseConfig";
import { esPASValido } from "../src/validators/pasValidator";


async function auditarPAS(): Promise<void> {

    const firestore = FirebaseConfig.getFirestore();

    const snapshot = await firestore
        .collection("productores")
        .get();

    let validos = 0;
    let invalidos = 0;

    console.log("================================");
    console.log("AUDITORÍA DE PRODUCTORES PAS");
    console.log("================================");

    for (const doc of snapshot.docs) {

        const datos: unknown = {
            ...doc.data(),
            id: doc.id
        };

        if (esPASValido(datos)) {
            validos++;
        } else {
            invalidos++;

            console.error(`PAS inválido: ${doc.id} | ${doc.get("nombre") ?? "Sin nombre"}`);
        }
    }

    console.log("\n================================");
    console.log("RESULTADO");
    console.log("================================");
    console.log(`Total: ${snapshot.size}`);
    console.log(`Válidos: ${validos}`);
    console.log(`Inválidos: ${invalidos}`);
}

auditarPAS()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("Error durante la auditoría:", error);
        process.exit(1);
    });