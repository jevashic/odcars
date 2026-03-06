import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Search, User, Package, CreditCard, Loader2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ───── Types ───── */
interface Branch {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  image_url: string | null;
  price_per_day: number;
  vehicles?: { id: string; status: string }[];
  availableCount: number;
}
interface Vehicle {
  id: string;
  license_plate: string;
  brand: string;
  model: string;
  color: string | null;
  mileage: number | null;
}
interface Extra {
  id: string;
  name: string;
  description?: string;
  price_per_reservation: number;
}
interface CustomerData {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  license_number: string;
  license_expiry: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

const PAYMENT_METHODS = [
  { value: "cash", label: "Pago en efectivo" },
  { value: "card", label: "Pago con tarjeta" },
  { value: "bizum", label: "Bizum" },
];

/* ────────────────── Component ────────────────── */
export default function NewReservation() {
  const navigate = useNavigate();

  /* ── Branches ── */
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pickupBranch, setPickupBranch] = useState("");
  const [returnBranch, setReturnBranch] = useState("");

  /* ── Dates ── */
  const [pickupDate, setPickupDate] = useState<Date | undefined>();
  const [returnDate, setReturnDate] = useState<Date | undefined>();
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("10:00");

  /* ── Availability ── */
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null); // null = auto

  /* ── Customer ── */
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customer, setCustomer] = useState<CustomerData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    license_number: "",
    license_expiry: "",
  });
  const [customerFound, setCustomerFound] = useState(false);

  /* ── Extras ── */
  const [extras, setExtras] = useState<Extra[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  /* ── Payment ── */
  const [paymentMethod, setPaymentMethod] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  /* ── Submit ── */
  const [submitting, setSubmitting] = useState(false);

  /* ────── Load branches + extras on mount ────── */
  useEffect(() => {
    supabase.from("branches").select("id, name").then(({ data }) => {
      if (data) setBranches(data);
    });
    supabase
      .from("extras")
      .select("id, name, description, price_per_reservation")
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (error) console.error("Error loading extras:", error);
        if (data) setExtras(data as Extra[]);
      });
  }, []);

  /* ────── Computed ────── */
  const days = useMemo(() => {
    if (!pickupDate || !returnDate) return 0;
    const d = differenceInDays(returnDate, pickupDate);
    return d > 0 ? d : 0;
  }, [pickupDate, returnDate]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedExtraItems = extras.filter((e) => selectedExtras.includes(e.id));

  const subtotal = useMemo(() => {
    let total = 0;
    if (selectedCategory && days > 0) {
      total += selectedCategory.price_per_day * days;
    }
    selectedExtraItems.forEach((e) => {
      total += e.price_per_reservation;
    });
    return total;
  }, [selectedCategory, days, selectedExtraItems]);

  const igic = subtotal * 0.07;
  const grandTotal = subtotal + igic;

  /* ────── Availability ────── */
  const handleCheckAvailability = async () => {
    if (!pickupBranch || !pickupDate || !returnDate) {
      toast({ title: "Completa fechas y oficina", variant: "destructive" });
      return;
    }
    setLoadingAvailability(true);
    setSelectedCategoryId(null);
    setVehicles([]);
    setSelectedVehicleId(null);

    try {
      const { data: cats, error } = await supabase
        .from("vehicle_categories")
        .select("*, vehicles(id, status)")
        .eq("is_active", true);

      if (error) {
        console.error("Error loading categories:", error);
        setCategories([]);
        return;
      }

      if (!cats) {
        setCategories([]);
        return;
      }

      const withCount: Category[] = cats.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        image_url: cat.image_url,
        price_per_day: cat.price_per_day,
        availableCount: (cat.vehicles || []).filter((v: any) => v.status === "available").length,
      }));

      setCategories(withCount);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingAvailability(false);
    }
  };

  /* ────── Load vehicles for selected category ────── */
  useEffect(() => {
    if (!selectedCategoryId) {
      setVehicles([]);
      return;
    }
    supabase
      .from("vehicles")
      .select("id, license_plate, brand, model, color, mileage")
      .eq("category_id", selectedCategoryId)
      .eq("status", "available")
      .then(({ data }) => {
        if (data) setVehicles(data as Vehicle[]);
      });
  }, [selectedCategoryId]);

  /* ────── Customer search ────── */
  const searchCustomer = useCallback(async () => {
    const q = customerSearch.trim();
    if (!q) return;
    setSearchingCustomer(true);
    try {
      const { data } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone, license_number, license_expiry")
        .or(`email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();
      if (data) {
        setCustomer({
          id: data.id,
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          license_number: data.license_number ?? "",
          license_expiry: data.license_expiry ?? "",
        });
        setCustomerFound(true);
      } else {
        setCustomerFound(false);
        setCustomer({
          first_name: "",
          last_name: "",
          email: q.includes("@") ? q : "",
          phone: !q.includes("@") ? q : "",
          license_number: "",
          license_expiry: "",
        });
      }
    } finally {
      setSearchingCustomer(false);
    }
  }, [customerSearch]);

  /* ────── Submit reservation ────── */
  const handleSubmit = async () => {
    if (!selectedCategoryId || !pickupDate || !returnDate || !pickupBranch || !customer.email) {
      toast({ title: "Completa todos los campos obligatorios", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sale_channel: "office",
        pickup_branch_id: pickupBranch,
        return_branch_id: returnBranch || pickupBranch,
        pickup_date: `${format(pickupDate, "yyyy-MM-dd")}T${pickupTime}`,
        return_date: `${format(returnDate, "yyyy-MM-dd")}T${returnTime}`,
        category_id: selectedCategoryId,
        vehicle_id: selectedVehicleId,
        customer: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          license_number: customer.license_number,
          license_expiry: customer.license_expiry,
        },
        extras: selectedExtras,
        payment_method: paymentMethod,
        internal_notes: internalNotes,
      };

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create_reservation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Error al crear la reserva');

      const resId = data?.reservation_id || data?.id;
      const resNumber = data?.reservation_number || "";

      toast({
        title: "Reserva creada",
        description: resNumber ? `Número: ${resNumber}` : "Reserva creada correctamente",
      });

      if (resId) {
        navigate(`/admin/reservas/${resId}`);
      } else {
        navigate("/admin/reservas");
      }
    } catch (e: any) {
      toast({ title: "Error al crear reserva", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  /* ────── Render ────── */
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Nueva reserva presencial</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ═══ LEFT: Form ═══ */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── STEP 1: Dates & Branch ── */}
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                <CalendarDays className="h-4 w-4" />
                PASO 1 — Fechas y oficina
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Oficina de recogida *</Label>
                  <Select value={pickupBranch} onValueChange={setPickupBranch}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar oficina" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Oficina de devolución</Label>
                  <Select value={returnBranch} onValueChange={setReturnBranch}>
                    <SelectTrigger><SelectValue placeholder="Misma oficina" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pickup date */}
                <div className="space-y-2">
                  <Label>Fecha de recogida *</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !pickupDate && "text-muted-foreground")}>
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {pickupDate ? format(pickupDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={pickupDate} onSelect={setPickupDate} locale={es} className="pointer-events-auto" /></PopoverContent>
                    </Popover>
                    <Select value={pickupTime} onValueChange={setPickupTime}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>{HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Return date */}
                <div className="space-y-2">
                  <Label>Fecha de devolución *</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !returnDate && "text-muted-foreground")}>
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {returnDate ? format(returnDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={returnDate} onSelect={setReturnDate} locale={es} className="pointer-events-auto" /></PopoverContent>
                    </Popover>
                    <Select value={returnTime} onValueChange={setReturnTime}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>{HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button onClick={handleCheckAvailability} disabled={loadingAvailability} className="w-full font-bold" variant="cta">
                {loadingAvailability ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consultando...</> : "VER DISPONIBILIDAD"}
              </Button>

              {/* Category cards */}
              {categories.length > 0 && (
                <div className="space-y-4 pt-2">
                  <Label className="text-sm font-bold">Selecciona categoría</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat) => {
                      const disabled = cat.availableCount === 0;
                      const selected = selectedCategoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          disabled={disabled}
                          onClick={() => { setSelectedCategoryId(cat.id); setSelectedVehicleId(null); }}
                          className={cn(
                            "border rounded-lg p-4 text-left transition-all",
                            disabled && "opacity-50 cursor-not-allowed",
                            selected ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-primary/50"
                          )}
                        >
                          {cat.image_url && (
                            <img src={cat.image_url} alt={cat.name} className="h-24 w-full object-contain mb-2 rounded" />
                          )}
                          <p className="font-bold text-sm">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">{cat.price_per_day.toFixed(2)} €/día</p>
                          {disabled ? (
                            <Badge variant="destructive" className="mt-2 text-xs">Sin disponibilidad</Badge>
                          ) : (
                            <Badge className="mt-2 text-xs bg-green-600 hover:bg-green-700">{cat.availableCount} disponibles</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vehicle table */}
              {vehicles.length > 0 && selectedCategoryId && (
                <div className="space-y-3 pt-2">
                  <Label className="text-sm font-bold">Asignar vehículo</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Matrícula</th>
                          <th className="px-3 py-2 text-left font-medium">Marca/Modelo</th>
                          <th className="px-3 py-2 text-left font-medium">Color</th>
                          <th className="px-3 py-2 text-left font-medium">Km</th>
                          <th className="px-3 py-2 text-left font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          onClick={() => setSelectedVehicleId(null)}
                          className={cn("cursor-pointer border-t transition-colors", !selectedVehicleId ? "bg-primary/5" : "hover:bg-muted/30")}
                        >
                          <td colSpan={4} className="px-3 py-2 italic text-muted-foreground">Asignación automática</td>
                          <td className="px-3 py-2">{!selectedVehicleId && <Badge className="bg-primary text-xs">Seleccionado</Badge>}</td>
                        </tr>
                        {vehicles.map((v) => (
                          <tr
                            key={v.id}
                            onClick={() => setSelectedVehicleId(v.id)}
                            className={cn("cursor-pointer border-t transition-colors", selectedVehicleId === v.id ? "bg-primary/5" : "hover:bg-muted/30")}
                          >
                            <td className="px-3 py-2 font-mono">{v.license_plate}</td>
                            <td className="px-3 py-2">{v.brand} {v.model}</td>
                            <td className="px-3 py-2">{v.color ?? "—"}</td>
                            <td className="px-3 py-2">{v.mileage != null ? `${v.mileage.toLocaleString()} km` : "—"}</td>
                            <td className="px-3 py-2">{selectedVehicleId === v.id && <Badge className="bg-primary text-xs">Seleccionado</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── STEP 2: Customer ── */}
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                <User className="h-4 w-4" />
                PASO 2 — Datos del cliente
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por email o teléfono"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchCustomer()}
                />
                <Button onClick={searchCustomer} variant="outline" disabled={searchingCustomer}>
                  {searchingCustomer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {customerFound && (
                <p className="text-xs text-green-600 font-medium">✓ Cliente encontrado — datos precargados</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={customer.first_name} onChange={(e) => setCustomer({ ...customer, first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input value={customer.last_name} onChange={(e) => setCustomer({ ...customer, last_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nº licencia conducir</Label>
                  <Input value={customer.license_number} onChange={(e) => setCustomer({ ...customer, license_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Caducidad carnet</Label>
                  <Input type="date" value={customer.license_expiry} onChange={(e) => setCustomer({ ...customer, license_expiry: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── STEP 3: Extras ── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                <Package className="h-4 w-4" />
                PASO 3 — Extras
              </div>
              {extras.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay extras disponibles</p>
              ) : (
                <div className="space-y-3">
                  {extras.map((ext) => (
                    <label key={ext.id} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={selectedExtras.includes(ext.id)}
                        onCheckedChange={(checked) => {
                          setSelectedExtras((prev) =>
                            checked ? [...prev, ext.id] : prev.filter((id) => id !== ext.id)
                          );
                        }}
                      />
                      <span className="text-sm flex-1">{ext.name}</span>
                      <span className="text-sm font-medium text-muted-foreground">{ext.price_per_reservation.toFixed(2)} €/reserva</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── STEP 4: Payment ── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                <CreditCard className="h-4 w-4" />
                PASO 4 — Pago
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar método de pago" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas internas</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Solo visible para el staff..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ RIGHT: Summary ═══ */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="font-bold text-lg text-foreground">Resumen</h2>
                <Separator />

                {/* Dates */}
                {pickupDate && returnDate && (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recogida</span>
                      <span>{format(pickupDate, "dd/MM/yyyy", { locale: es })} {pickupTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Devolución</span>
                      <span>{format(returnDate, "dd/MM/yyyy", { locale: es })} {returnTime}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Días</span>
                      <span>{days}</span>
                    </div>
                  </div>
                )}

                {/* Category */}
                {selectedCategory && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categoría</span>
                        <span className="font-medium">{selectedCategory.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{selectedCategory.price_per_day.toFixed(2)} € × {days} días</span>
                        <span>{(selectedCategory.price_per_day * days).toFixed(2)} €</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Vehicle */}
                {selectedCategoryId && (
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vehículo</span>
                      <span>{selectedVehicle ? selectedVehicle.license_plate : "Asignación automática"}</span>
                    </div>
                  </div>
                )}

                {/* Extras */}
                {selectedExtraItems.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-muted-foreground">Extras</p>
                      {selectedExtraItems.map((e) => (
                        <div key={e.id} className="flex justify-between">
                          <span>{e.name}</span>
                          <span>{e.price_per_reservation.toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Totals */}
                {subtotal > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{subtotal.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IGIC (7%)</span>
                        <span>{igic.toFixed(2)} €</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-base pt-1">
                        <span>Total</span>
                        <span>{grandTotal.toFixed(2)} €</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Payment method */}
                <div className="text-sm flex justify-between">
                  <span className="text-muted-foreground">Pago</span>
                  <span>{PAYMENT_METHODS.find((p) => p.value === paymentMethod)?.label ?? "—"}</span>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedCategoryId || !pickupDate || !returnDate || !customer.email || !paymentMethod}
                  className="w-full font-bold mt-4"
                >
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</> : "CREAR RESERVA"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
