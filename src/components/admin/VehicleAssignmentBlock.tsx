import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Car, RefreshCw } from "lucide-react";

interface Props {
  reservation: any;
  userId: string;
  onComplete: () => void;
}

async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_log").insert({
    performed_by: userId, action, table_name: tableName, record_id: recordId,
    old_data: oldData as any, new_data: newData as any,
  });
}

export default function VehicleAssignmentBlock({ reservation, userId, onComplete }: Props) {
  const r = reservation;
  const [assigning, setAssigning] = useState(false);
  const [changing, setChanging] = useState(false);

  const hasVehicle = !!r.vehicle_id;

  const { data: availableVehicles = [], isLoading } = useQuery({
    queryKey: ["available-vehicles", r.category_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, brand, model, year, color, plate, transmission, seats, images")
        .eq("category_id", r.category_id)
        .eq("status", "available")
        .order("brand");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !hasVehicle || changing,
  });

  const assignVehicle = async (vehicleId: string) => {
    setAssigning(true);
    try {
      // If replacing, free the old vehicle
      if (r.vehicle_id) {
        await supabase.from("vehicles").update({ status: "available" }).eq("id", r.vehicle_id);
      }

      const { error: e1 } = await supabase
        .from("reservations")
        .update({ vehicle_id: vehicleId, status: "confirmed" })
        .eq("id", r.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("vehicles")
        .update({ status: "rented" })
        .eq("id", vehicleId);
      if (e2) throw e2;

      await writeAudit(userId, "update", "reservations", r.id,
        { vehicle_id: r.vehicle_id, status: r.status },
        { vehicle_id: vehicleId, status: "confirmed" }
      );

      toast({ title: "Vehículo asignado correctamente" });
      setChanging(false);
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  // Show assigned vehicle info
  if (hasVehicle && !changing) {
    const v = r.vehicles;
    const imgUrl = v?.images?.[0] || "/placeholder.svg";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="h-5 w-5" /> Vehículo asignado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <img src={imgUrl} alt={`${v?.brand} ${v?.model}`} className="w-full h-32 object-cover rounded-md bg-muted" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">{v?.brand} {v?.model}</p>
            <p className="text-muted-foreground">Matrícula: {v?.plate}</p>
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={() => setChanging(true)}>
            <RefreshCw className="h-4 w-4" /> CAMBIAR VEHÍCULO
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show available vehicles to assign
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          🚗 Asignar vehículo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {changing && (
          <Button variant="ghost" size="sm" className="mb-2" onClick={() => setChanging(false)}>
            ← Cancelar cambio
          </Button>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : availableVehicles.length === 0 ? (
          <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
            No hay vehículos disponibles en esta categoría
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableVehicles.map((v: any) => {
              const imgUrl = v.images?.[0] || "/placeholder.svg";
              return (
                <div key={v.id} className="border rounded-lg p-3 space-y-2">
                  <img src={imgUrl} alt={`${v.brand} ${v.model}`} className="w-full h-28 object-cover rounded-md bg-muted" />
                  <div className="text-sm space-y-0.5">
                    <p className="font-semibold">{v.brand} {v.model} {v.year && `(${v.year})`}</p>
                    <p className="text-muted-foreground">Matrícula: {v.plate}</p>
                    <p className="text-muted-foreground">
                      {[v.color, v.transmission, v.seats ? `${v.seats} plazas` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => assignVehicle(v.id)}
                    disabled={assigning}
                  >
                    {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    ASIGNAR ESTE VEHÍCULO
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
