import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FeedScreen from "../screens/FeedScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import NewAnnouncementScreen from "../screens/NewAnnouncementScreen";

const Stack = createNativeStackNavigator();

// Pestaña Inicio: feeds Para Ti / Anuncios, comentarios de una publicación y (admin) nuevo anuncio.
export default function FeedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FeedInicio" component={FeedScreen} options={{ title: "Inicio" }} />
      <Stack.Screen name="DetallePublicacion" component={PostDetailScreen} options={{ title: "Publicación" }} />
      <Stack.Screen name="NuevoAnuncio" component={NewAnnouncementScreen} options={{ title: "Nuevo anuncio" }} />
    </Stack.Navigator>
  );
}