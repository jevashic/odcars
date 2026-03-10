import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, FileText } from "lucide-react";

interface Props {
  reservation: any;
  userId: string;
  onComplete: () => void;
}

async function writeAudit(userId: string, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  await supabase.from("audit_logs").insert({
    performed_by: userId, action, table_name: tableName, record_id: recordId,
    old_data: oldData as any, new_data: newData as any,
  });
}

export default function ReturnBlock({ reservation, userId, onComplete }: Props) {
  const r = reservation;
  const vehicleId = r.vehicle_id || r.vehicles?.id;

  const [mileage, setMileage] = useState<number | "">("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [batteryPercent, setBatteryPercent] = useState<number | "">("");
  const [exteriorCondition, setExteriorCondition] = useState("");
  const [interiorCondition, setInteriorCondition] = useState("");
  const [damagesFound, setDamagesFound] = useState(false);
  const [damageDescription, setDamageDescription] = useState("");
  const [damageAmount, setDamageAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Get category info
  const { data: category } = useQuery({
    queryKey: ["vehicle-category-energy-return", r.category_id],
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

  // Get pickup inspection for comparison
  const { data: pickupInspection } = useQuery({
    queryKey: ["pickup-inspection", r.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle_inspections")
        .select("*")
        .eq("reservation_id", r.id)
        .eq("inspection_type", "pickup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!r.id,
  });

  // Get energy config for pricing
  const { data: energyConfig } = useQuery({
    queryKey: ["energy-config", category?.energy_type],
    queryFn: async () => {
      const { data } = await supabase
        .from("energy_config")
        .select("*")
        .eq("energy_type", category!.energy_type!)
        .maybeSingle();
      return data;
    },
    enabled: !!category?.energy_type,
  });

  const isElectric = category?.energy_type === "electric";

  // Calculate charges
  const charges = useMemo(() => {
    let fuelCharge = 0;
    let managementFee = 0;
    let fuelDiff = 0;

    if (!isElectric) {
      const pickupFuel = pickupInspection?.fuel_level_eighths ?? 0;
      const returnFuel = fuelLevel ? Number(fuelLevel) : 0;
      if (returnFuel < pickupFuel && energyConfig && category?.tank_capacity_liters) {
        fuelDiff = pickupFuel - returnFuel;
        const litrsMissing = fuelDiff * (category.tank_capacity_liters / 8);
        fuelCharge = litrsMissing * (energyConfig.price_per_liter ?? 0);
        managementFee = energyConfig.fuel_management_fee ?? 0;
      }
    } else {
      const pickupBatt = pickupInspection?.battery_percent ?? 0;
      const returnBatt = batteryPercent !== "" ? Number(batteryPercent) : 0;
      if (returnBatt < pickupBatt && energyConfig && category?.battery_capacity_kwh) {
        fuelDiff = pickupBatt - returnBatt;
        const kwhMissing = fuelDiff * category.battery_capacity_kwh / 100;
        fuelCharge = kwhMissing * (energyConfig.price_per_kwh ?? 0);
        managementFee = energyConfig.electric_management_fee ?? 0;
      }
    }

    const damageChg = damagesFound ? damageAmount : 0;
    const total = fuelCharge + managementFee + damageChg;

    return { fuelCharge, managementFee, damageChg, total, fuelDiff };
  }, [isElectric, fuelLevel, batteryPercent, pickupInspection, energyConfig, category, damagesFound, damageAmount]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    setPhotos(prev => [...prev, ...files]);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
  }, []);

  const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of photos) {
      const path = `inspections/${r.id}/return/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("fuel-photos").upload(path, file);
      if (error) { console.error("Upload error:", error); continue; }
      const { data: urlData } = supabase.storage.from("fuel-photos").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!mileage) {
      toast({ title: "El kilometraje es obligatorio", variant: "destructive" });
      return;
    }
    if (!vehicleId) {
      toast({ title: "No hay vehículo asignado", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos() : [];

      // 1. Insert inspection
      const inspectionData: any = {
        reservation_id: r.id,
        vehicle_id: vehicleId,
        inspection_type: "return",
        mileage: Number(mileage),
        exterior_condition: exteriorCondition || null,
        interior_condition: interiorCondition || null,
        damages_found: damagesFound,
        damage_description: damagesFound ? damageDescription || null : null,
        damage_amount: damagesFound ? damageAmount : 0,
        photo_urls: photoUrls,
        notes: notes || null,
        performed_by: userId,
      };
      if (!isElectric && fuelLevel) inspectionData.fuel_level_eighths = Number(fuelLevel);
      if (isElectric && batteryPercent !== "") inspectionData.battery_percent = Number(batteryPercent);

      const { error: insErr } = await supabase.from("vehicle_inspections").insert(inspectionData);
      if (insErr) throw insErr;

      // 2. Insert fuel_energy_records if applicable
      if (charges.fuelCharge > 0 || charges.managementFee > 0) {
        const record: any = {
          reservation_id: r.id,
          vehicle_id: vehicleId,
          energy_type: category?.energy_type,
          management_fee: charges.managementFee,
          total_charge: charges.fuelCharge + charges.managementFee,
        };
        if (!isElectric) {
          record.pickup_fuel_level = pickupInspection?.fuel_level_eighths;
          record.return_fuel_level = Number(fuelLevel);
          record.liters_missing = charges.fuelDiff * ((category?.tank_capacity_liters ?? 0) / 8);
          record.price_per_liter = energyConfig?.price_per_liter;
          record.fuel_charge = charges.fuelCharge;
        } else {
          record.pickup_battery_percent = pickupInspection?.battery_percent;
          record.return_battery_percent = Number(batteryPercent);
          record.kwh_missing = charges.fuelDiff * (category?.battery_capacity_kwh ?? 0) / 100;
          record.price_per_kwh = energyConfig?.price_per_kwh;
          record.electric_charge = charges.fuelCharge;
        }
        await supabase.from("fuel_energy_records").insert(record);
      }

      // 3. Insert additional charges
      if (charges.fuelCharge + charges.managementFee > 0) {
        await supabase.from("reservation_additional_charges").insert({
          reservation_id: r.id,
          charge_type: isElectric ? "electric" : "fuel",
          description: isElectric ? "Cargo batería" : "Cargo combustible",
          amount: charges.fuelCharge + charges.managementFee,
          included_in_invoice: true,
        });
      }
      if (charges.damageChg > 0) {
        await supabase.from("reservation_additional_charges").insert({
          reservation_id: r.id,
          charge_type: "damage",
          description: damageDescription || "Daños al vehículo",
          amount: charges.damageChg,
          included_in_invoice: true,
        });
      }

      // 4. Update reservation
      const { error: resErr } = await supabase
        .from("reservations")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", r.id);
      if (resErr) throw resErr;

      // 5. Update vehicle
      await supabase.from("vehicles")
        .update({ status: "available", mileage: Number(mileage) })
        .eq("id", vehicleId);

      // 6. Audit
      await writeAudit(userId, "create", "vehicle_inspections", r.id, null,
        { inspection_type: "return", mileage: Number(mileage) });
      await writeAudit(userId, "update", "reservations", r.id,
        { status: "active" },
        { status: "completed", additional_charges: charges.total });

      const chargeMsg = charges.total > 0 ? ` — Cargos: ${charges.total.toFixed(2)} €` : "";
      toast({ title: `✅ Devolución completada${chargeMsg}` });
      setCompleted(true);
      onComplete();
    } catch (err: any) {
      console.error("Return error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("issue_invoice", {
        body: { reservation_id: r.id },
      });
      if (error) throw error;
      toast({ title: "📄 Factura generada correctamente" });
      onComplete();
    } catch (err: any) {
      toast({ title: "Error al generar factura", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔑 Devolución completada</CardTitle>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleGenerateInvoice} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <FileText className="h-4 w-4 mr-2" /> GENERAR FACTURA
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pickupFuelLabel = !isElectric
    ? `${pickupInspection?.fuel_level_eighths ?? "?"}/8`
    : `${pickupInspection?.battery_percent ?? "?"}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🔑 Devolución del vehículo</CardTitle>
        <CardDescription>Registrar estado al entrar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Kilometraje entrada *</Label>
          <Input type="number" value={mileage} onChange={e => setMileage(e.target.value ? Number(e.target.value) : "")} placeholder="Km actuales" />
        </div>

        {!isElectric && (
          <div className="space-y-1.5">
            <Label>Nivel combustible entrada <span className="text-xs text-muted-foreground">(salida: {pickupFuelLabel})</span></Label>
            <Select value={fuelLevel} onValueChange={setFuelLevel}>
              <SelectTrigger><SelectValue placeholder="Seleccionar nivel" /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,7,8].map(n => {
                  const isLow = pickupInspection?.fuel_level_eighths != null && n < pickupInspection.fuel_level_eighths;
                  return (
                    <SelectItem key={n} value={String(n)}>
                      <span className={isLow ? "text-destructive font-medium" : ""}>{n}/8{isLow ? " ↓" : ""}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {isElectric && (
          <div className="space-y-1.5">
            <Label>Batería % entrada <span className="text-xs text-muted-foreground">(salida: {pickupFuelLabel})</span></Label>
            <Input type="number" min={0} max={100} value={batteryPercent} onChange={e => setBatteryPercent(e.target.value ? Number(e.target.value) : "")} placeholder="0-100" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Estado exterior</Label>
          <Textarea value={exteriorCondition} onChange={e => setExteriorCondition(e.target.value)} rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>Estado interior</Label>
          <Textarea value={interiorCondition} onChange={e => setInteriorCondition(e.target.value)} rows={2} />
        </div>

        <div className="flex items-center justify-between">
          <Label>¿Se detectaron daños?</Label>
          <Switch checked={damagesFound} onCheckedChange={setDamagesFound} />
        </div>

        {damagesFound && (
          <>
            <div className="space-y-1.5">
              <Label>Descripción daños</Label>
              <Textarea value={damageDescription} onChange={e => setDamageDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Importe daños (€)</Label>
              <Input type="number" value={damageAmount} onChange={e => setDamageAmount(Number(e.target.value))} />
            </div>
          </>
        )}

        {/* Photo upload */}
        <div className="space-y-1.5">
          <Label>Fotos del vehículo</Label>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed rounded-md p-4 text-center text-sm text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById("return-photos")?.click()}
          >
            <Upload className="h-5 w-5 mx-auto mb-1" />
            Arrastra fotos aquí o haz clic para seleccionar
            <input id="return-photos" type="file" multiple accept="image/*" className="hidden" onChange={handleFileInput} />
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
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>

        {/* Charges summary */}
        {charges.total > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">Resumen de cargos adicionales</p>
              {charges.fuelCharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isElectric ? "Cargo batería" : "Cargo combustible"}:</span>
                  <span>{charges.fuelCharge.toFixed(2)} €</span>
                </div>
              )}
              {charges.managementFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cargo gestión:</span>
                  <span>{charges.managementFee.toFixed(2)} €</span>
                </div>
              )}
              {charges.damageChg > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cargo daños:</span>
                  <span>{charges.damageChg.toFixed(2)} €</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-destructive">
                <span>TOTAL CARGOS ADICIONALES:</span>
                <span>{charges.total.toFixed(2)} €</span>
              </div>
            </div>
          </>
        )}

        <Button className="w-full" onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          CONFIRMAR DEVOLUCIÓN Y COMPLETAR RESERVA
        </Button>
      </CardContent>
    </Card>
  );
}
