import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthStack from "./navigation/AuthStack";
import RootTabs from "./navigation/RootTabs";

function Contenido() {
  const { token, perfil, verificandoSesion } = useAuth();

  if (verificandoSesion) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token || !perfil) {
    return <AuthStack />;
  }

  return <RootTabs />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Contenido />
      </NavigationContainer>
    </AuthProvider>
  );
}