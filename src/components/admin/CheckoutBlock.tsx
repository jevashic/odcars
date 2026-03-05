import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";

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

export default function CheckoutBlock({ reservation, userId, onComplete }: Props) {
  const r = reservation;

  const [assignVehicleId, setAssignVehicleId] = useState(r.vehicle_id ?? "");
  const [mileage, setMileage] = useState<number | "">("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [batteryPercent, setBatteryPercent] = useState<number | "">("");
  const [exteriorCondition, setExteriorCondition] = useState("");
  const [interiorCondition, setInteriorCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Check if pickup already done
  const { data: existingPickup } = useQuery({
    queryKey: ["pickup-inspection-exists", r.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle_inspections")
        .select("id")
        .eq("reservation_id", r.id)
        .eq("inspection_type", "pickup")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!r.id,
  });

  // Available vehicles for assignment (only if confirmed)
  const { data: availableVehicles = [] } = useQuery({
    queryKey: ["admin-available-vehicles-checkout", r.category_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, license_plate, brand, model")
        .eq("category_id", r.category_id)
        .eq("status", "available");
      return data ?? [];
    },
    enabled: !!r.category_id && r.status === "confirmed",
  });

  // Get category energy type
  const { data: category } = useQuery({
    queryKey: ["vehicle-category-energy", r.category_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle_categories")
        .select("energy_type, tank_capacity_liters, battery_capacity_kwh")
        .eq("id", r.category_id)
        .single();
      return data;
    },
    enabled: !!r.category_id,
  });

  const isElectric = category?.energy_type === "electric";

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    setPhotos(prev => [...prev, ...files]);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of photos) {
      const path = `inspections/${r.id}/pickup/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("fuel-photos").upload(path, file);
      if (error) { console.error("Upload error:", error); continue; }
      const { data: urlData } = supabase.storage.from("fuel-photos").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  // Don't render if pickup already done
  if (existingPickup) return null;

  const handleSubmit = async () => {
    if (!mileage) {
      toast({ title: "El kilometraje es obligatorio", variant: "destructive" });
      return;
    }
    const vehicleId = assignVehicleId || r.vehicle_id || r.vehicles?.id;
    if (!vehicleId) {
      toast({ title: "Selecciona un vehículo", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos() : [];

      const inspectionData: any = {
        reservation_id: r.id,
        vehicle_id: vehicleId,
        inspection_type: "pickup",
        mileage: Number(mileage),
        exterior_condition: exteriorCondition || null,
        interior_condition: interiorCondition || null,
        damages_found: false,
        photo_urls: photoUrls,
        notes: notes || null,
        performed_by: userId,
      };

      if (!isElectric && fuelLevel) {
        inspectionData.fuel_level_eighths = Number(fuelLevel);
      }
      if (isElectric && batteryPercent !== "") {
        inspectionData.battery_percent = Number(batteryPercent);
      }

      const { error: insErr } = await supabase.from("vehicle_inspections").insert(inspectionData);
      if (insErr) throw insErr;

      const resUpdate: any = { status: "active" };
      if (!r.vehicle_id) resUpdate.vehicle_id = vehicleId;

      const { error: resErr } = await supabase
        .from("reservations")
        .update(resUpdate)
        .eq("id", r.id);
      if (resErr) throw resErr;

      const { error: vehErr } = await supabase
        .from("vehicles")
        .update({ status: "rented" })
        .eq("id", vehicleId);
      if (vehErr) throw vehErr;

      await writeAudit(userId, "create", "vehicle_inspections", r.id,
        null, { inspection_type: "pickup", mileage: Number(mileage) });
      await writeAudit(userId, "update", "reservations", r.id,
        { status: r.status }, { status: "active" });

      toast({ title: "✅ Entrega registrada y reserva activada" });
      onComplete();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🚗 Entrega del vehículo</CardTitle>
        <CardDescription>Registrar estado al salir</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Kilometraje salida *</Label>
          <Input type="number" value={mileage} onChange={e => setMileage(e.target.value ? Number(e.target.value) : "")} placeholder="Km actuales" />
        </div>

        {!isElectric && (
          <div className="space-y-1.5">
            <Label>Nivel combustible salida</Label>
            <Select value={fuelLevel} onValueChange={setFuelLevel}>
              <SelectTrigger><SelectValue placeholder="Seleccionar nivel" /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,7,8].map(n => (
                  <SelectItem key={n} value={String(n)}>{n}/8</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isElectric && (
          <div className="space-y-1.5">
            <Label>Batería % salida</Label>
            <Input type="number" min={0} max={100} value={batteryPercent} onChange={e => setBatteryPercent(e.target.value ? Number(e.target.value) : "")} placeholder="0-100" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Estado exterior</Label>
          <Textarea value={exteriorCondition} onChange={e => setExteriorCondition(e.target.value)} rows={2} placeholder="Descripción del estado exterior…" />
        </div>

        <div className="space-y-1.5">
          <Label>Estado interior</Label>
          <Textarea value={interiorCondition} onChange={e => setInteriorCondition(e.target.value)} rows={2} placeholder="Descripción del estado interior…" />
        </div>

        {/* Photo upload */}
        <div className="space-y-1.5">
          <Label>Fotos del vehículo</Label>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed rounded-md p-4 text-center text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById("checkout-photos")?.click()}
          >
            <Upload className="h-5 w-5 mx-auto mb-1" />
            Arrastra fotos aquí o haz clic para seleccionar
            <input id="checkout-photos" type="file" multiple accept="image/*" className="hidden" onChange={handleFileInput} />
          </div>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {photos.map((f, i) => (
                <div key={i} className="relative group">
                  <img src={URL.createObjectURL(f)} className="h-16 w-16 object-cover rounded" alt="" />
                  <button onClick={() => removePhoto(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observaciones adicionales…" />
        </div>

        <Button className="w-full" onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          REGISTRAR ENTREGA Y ACTIVAR RESERVA
        </Button>
      </CardContent>
    </Card>
  );
}
