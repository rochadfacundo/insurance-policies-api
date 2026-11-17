
import express, { Request, Response } from "express";
import productoresRoutes from "./routes/productoresRoutes";

const app = express();

app.use(express.json());

// Endpoint público de salud
app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
        status: "OK",
        servicio: "apiCartera"
    });
});

// Endpoints protegidos de productores
app.use("/productores", productoresRoutes);

export default app;
