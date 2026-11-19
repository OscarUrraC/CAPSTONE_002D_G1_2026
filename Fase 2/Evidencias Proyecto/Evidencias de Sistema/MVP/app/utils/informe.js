import * as Sharing from "expo-sharing";
import { descargarInformeSancion } from "../services/api";

// Descarga el informe y abre el menú de compartir del teléfono (guardar, abrir con un visor, enviar).
export async function descargarYCompartirInforme(token, idSancion) {
  const uri = await descargarInformeSancion(token, idSancion);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Este dispositivo no permite compartir archivos");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Informe de incidente",
  });
}