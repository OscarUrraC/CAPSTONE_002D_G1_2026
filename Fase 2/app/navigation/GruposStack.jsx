import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GroupsScreen from "../screens/GroupsScreen";
import GroupDetailScreen from "../screens/GroupDetailScreen";
import GroupMembersScreen from "../screens/GroupMembersScreen";

const Stack = createNativeStackNavigator();

export default function GruposStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ListaGrupos" component={GroupsScreen} options={{ title: "Grupos" }} />
      <Stack.Screen name="DetalleGrupo" component={GroupDetailScreen} options={{ title: "Grupo" }} />
      <Stack.Screen name="MiembrosGrupo" component={GroupMembersScreen} options={{ title: "Miembros" }} />
    </Stack.Navigator>
  );
}
