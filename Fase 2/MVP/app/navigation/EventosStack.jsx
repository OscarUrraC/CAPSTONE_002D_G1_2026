import { createNativeStackNavigator } from "@react-navigation/native-stack";
import EventsScreen from "../screens/EventsScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import EventFormScreen from "../screens/EventFormScreen";

const Stack = createNativeStackNavigator();

export default function EventosStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ListaEventos" component={EventsScreen} options={{ title: "Eventos" }} />
      <Stack.Screen name="DetalleEvento" component={EventDetailScreen} options={{ title: "Evento" }} />
      <Stack.Screen name="FormularioEvento" component={EventFormScreen} options={{ title: "Evento" }} />
    </Stack.Navigator>
  );
}