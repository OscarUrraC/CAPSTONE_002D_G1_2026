import { notificacionesRouter } from "./routes/notificaciones.js";
import { iniciarPlanificador } from "./services/notificacionesService.js";
import express from "express";
import { eventosRouter } from "./routes/eventos.js";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { perfilRouter } from "./routes/perfil.js";
import { gruposRouter } from "./routes/grupos.js";
import { reportesRouter } from "./routes/reportes.js";
import { feedRouter } from "./routes/feed.js";
import { publicacionesRouter } from "./routes/publicaciones.js";
import { comentariosRouter } from "./routes/comentarios.js";

const app = express();

app.use(cors());
app.use(express.json());
iniciarPlanificador();
app.use("/auth", authRouter);
app.use("/notificaciones", notificacionesRouter);
app.use("/perfil", perfilRouter);
app.use("/grupos", gruposRouter);
app.use("/reportes", reportesRouter);
app.use("/eventos", eventosRouter);
app.use("/feed", feedRouter);
app.use("/publicaciones", publicacionesRouter);
app.use("/comentarios", comentariosRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend Connectboard escuchando en el puerto ${PORT}`);
  iniciarPlanificador();
});