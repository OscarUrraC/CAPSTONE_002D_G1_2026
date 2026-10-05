import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { perfilRouter } from "./routes/perfil.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);
app.use("/perfil", perfilRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend Connectboard escuchando en el puerto ${PORT}`);
});