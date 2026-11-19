import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminReportsScreen from "../screens/AdminReportsScreen";
import AdminReportDetailScreen from "../screens/AdminReportDetailScreen";
import AdminReviewQueueScreen from "../screens/AdminReviewQueueScreen";
import AdminReviewDetailScreen from "../screens/AdminReviewDetailScreen";
import AdminThresholdsScreen from "../screens/AdminThresholdsScreen";

const Stack = createNativeStackNavigator();

export default function AdminStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminReportes" component={AdminReportsScreen} options={{ title: "Moderación" }} />
      <Stack.Screen
        name="AdminReporteDetalle"
        component={AdminReportDetailScreen}
        options={{ title: "Detalle del reporte" }}
      />
      <Stack.Screen name="AdminRevisionIA" component={AdminReviewQueueScreen} options={{ title: "Revisión por IA" }} />
      <Stack.Screen
        name="AdminRevisionDetalle"
        component={AdminReviewDetailScreen}
        options={{ title: "Publicación retenida" }}
      />
      <Stack.Screen name="AdminUmbrales" component={AdminThresholdsScreen} options={{ title: "Umbrales de moderación" }} />
    </Stack.Navigator>
  );
}