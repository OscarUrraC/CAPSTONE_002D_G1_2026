import { createNativeStackNavigator } from "@react-navigation/native-stack";
import FeedScreen from "../screens/FeedScreen";
import PostDetailScreen from "../screens/PostDetailScreen";

const Stack = createNativeStackNavigator();

// Pestaña Inicio: el feed Para Ti y, encima, la pantalla de comentarios de una publicación.
export default function FeedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FeedInicio" component={FeedScreen} options={{ title: "Para Ti" }} />
      <Stack.Screen name="DetallePublicacion" component={PostDetailScreen} options={{ title: "Publicación" }} />
    </Stack.Navigator>
  );
}
