import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import FeedStack from "./FeedStack";
import GruposStack from "./GruposStack";
import EventosStack from "./EventosStack";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileStack from "./ProfileStack";
import AdminStack from "./AdminStack";

const Tab = createBottomTabNavigator();

// Nombre de la pestaña -> [ícono cuando está activa, ícono cuando está inactiva] (Ionicons).
const ICONOS = {
  Home: ["home", "home-outline"],
  Grupos: ["people", "people-outline"],
  Eventos: ["calendar", "calendar-outline"],
  Perfil: ["person", "person-outline"],
  Notificaciones: ["notifications", "notifications-outline"],
  Moderacion: ["shield-checkmark", "shield-checkmark-outline"],
};

export default function RootTabs() {
  const { perfil } = useAuth();
  // Solo comodidad visual: el permiso real lo impone el backend en cada ruta /admin.
  const esAdmin = perfil?.rol_plataforma === "administrador";

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#6b7280",
        tabBarIcon: ({ focused, color, size }) => {
          const [activo, inactivo] = ICONOS[route.name];
          return <Ionicons name={focused ? activo : inactivo} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={FeedStack} options={{ title: "Inicio" }} />
      <Tab.Screen name="Grupos" component={GruposStack} />
      <Tab.Screen name="Eventos" component={EventosStack} />
      <Tab.Screen name="Perfil" component={ProfileStack} />
      <Tab.Screen name="Notificaciones" component={NotificationsScreen} />
      {esAdmin && <Tab.Screen name="Moderacion" component={AdminStack} options={{ title: "Moderación" }} />}
    </Tab.Navigator>
  );
}