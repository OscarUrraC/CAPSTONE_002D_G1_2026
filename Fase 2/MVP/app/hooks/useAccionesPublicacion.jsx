import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { eliminarPublicacion, eliminarAnuncio } from "../services/api";
import { emitirPublicacion, suscribirPublicacion } from "../utils/eventosPublicacion";
import MenuAcciones from "../components/MenuAcciones";
import ReportarModal from "../components/ReportarModal";
import SancionarModal from "../components/SancionarModal";

// Todo lo que se puede hacer con una publicación (reportar, sancionar, eliminar) vive aquí, una sola vez.
// Qué opciones aparecen lo decide el backend (publicacion.permisos); este hook solo las dibuja.
//
// onQuitada({ id_publicacion }): se llama cuando una publicación dejó de ser visible (eliminada o
// sancionada) desde CUALQUIER pantalla, para que esta la saque de su lista. Es un aviso por el bus de
// eventos, así que el feed, el grupo y el detalle se enteran a la vez.
//
// Uso:
//   const { abrirMenu, modales } = useAccionesPublicacion({ onQuitada });
//   ... abrirMenu(publicacion) ...
//   return (<> ...tu pantalla... {modales} </>);
export default function useAccionesPublicacion({ onQuitada }) {
  const { token } = useAuth();
  const [menu, setMenu] = useState({ visible: false, publicacion: null });
  const [objetivoReporte, setObjetivoReporte] = useState(null);
  const [sancionando, setSancionando] = useState(null); // la publicación cuyo autor se va a sancionar

  // La ref evita que el oyente quede con una versión vieja de onQuitada.
  const onQuitadaRef = useRef(onQuitada);
  onQuitadaRef.current = onQuitada;

  useEffect(() => {
    return suscribirPublicacion((cambios) => {
      if (cambios.eliminada) onQuitadaRef.current({ id_publicacion: cambios.id_publicacion });
    });
  }, []);

  function anunciarQuitada(p) {
    emitirPublicacion({ id_publicacion: p.id_publicacion, eliminada: true });
  }

  function confirmarEliminar(p) {
    const esAnuncio = p.tipo === "anuncio";
    Alert.alert(
      esAnuncio ? "Eliminar anuncio" : "Eliminar publicación",
      esAnuncio ? "El anuncio dejará de ser visible para todos los estudiantes." : "Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              if (esAnuncio) await eliminarAnuncio(token, p.id_publicacion);
              else await eliminarPublicacion(token, p.id_grupo, p.id_publicacion);
              anunciarQuitada(p);
            } catch (e) {
              Alert.alert("No se pudo eliminar", e.message);
            }
          },
        },
      ]
    );
  }

  function opcionesDe(p) {
    if (!p) return [];
    const permisos = p.permisos ?? {};
    const lista = [];
    if (permisos.reportar) {
      lista.push({ texto: "Reportar publicación", onPress: () => setObjetivoReporte({ id_publicacion: p.id_publicacion }) });
    }
    if (permisos.sancionar) {
      lista.push({ texto: "Sancionar al autor", peligro: true, onPress: () => setSancionando(p) });
    }
    if (permisos.eliminar) {
      lista.push({
        texto: p.tipo === "anuncio" ? "Eliminar anuncio" : "Eliminar publicación",
        peligro: true,
        onPress: () => confirmarEliminar(p),
      });
    }
    return lista;
  }

  const modales = (
    <>
      {/* visible y publicacion van separados: al cerrar, la lista no se vacía mientras baja la animación. */}
      <MenuAcciones
        visible={menu.visible}
        opciones={opcionesDe(menu.publicacion)}
        onCerrar={() => setMenu((m) => ({ ...m, visible: false }))}
      />
      <ReportarModal objetivo={objetivoReporte} onCerrar={() => setObjetivoReporte(null)} />
      <SancionarModal
        objetivo={sancionando ? { id_publicacion: sancionando.id_publicacion } : null}
        onCerrar={() => setSancionando(null)}
        onListo={() => anunciarQuitada(sancionando)}
      />
    </>
  );

  return { abrirMenu: (publicacion) => setMenu({ visible: true, publicacion }), modales };
}