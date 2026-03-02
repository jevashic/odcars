import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight } from "lucide-react";

interface CategoryWithVehicles {
  id: string;
  name: string;
  image_url: string | null;
  vehicles: { id: string; status: string }[];
}

export default function VehicleCategories() {
  const navigate = useNavigate();

  const { data: categories = [], isLoading } = useQuery<CategoryWithVehicles[]>({
    queryKey: ["admin-vehicle-categories-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_categories")
        .select("id, name, image_url, vehicles(id, status)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CategoryWithVehicles[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Flota</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((cat) => {
          const total = cat.vehicles.length;
          const available = cat.vehicles.filter((v) => v.status === "available").length;
          const maintenance = cat.vehicles.filter((v) => v.status === "maintenance").length;
          const rented = cat.vehicles.filter((v) => v.status === "rented").length;

          return (
            <div
              key={cat.id}
              className="bg-background border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {cat.image_url ? (
                <img src={cat.image_url} alt={cat.name} className="w-full h-44 object-cover" />
              ) : (
                <div className="w-full h-44 bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  Sin imagen
                </div>
              )}

              <div className="p-5 space-y-4">
                <h3 className="text-lg font-semibold text-foreground">{cat.name}</h3>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{total} total</Badge>
                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                    {available} disponibles
                  </Badge>
                  <Badge className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
                    {maintenance} en taller
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                    {rented} alquilados
                  </Badge>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={() => navigate(`/admin/vehiculos/${cat.id}`)}
                >
                  Ver vehículos <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {categories.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No hay categorías activas.</p>
      )}
    </div>
  );
}
