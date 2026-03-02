import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Eye, Pencil, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ── Constants ──────────────────────────────────────── */

const PAGE_SIZE = 15;

/* ── Audit helper ───────────────────────────────────── */

async function writeAudit(
  userId: string,
  action: string,
  tableName: string,
  recordId: string,
  oldData: unknown,
  newData: unknown
) {
  await supabase.from("audit_log").insert({
    performed_by: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData as any,
    new_data: newData as any,
  });
}

/* ── Main Component ─────────────────────────────────── */

export default function AdminCustomers() {
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  /* ── Main query ──────────────────────────────────── */

  const { data: resData, isLoading } = useQuery({
    queryKey: ["admin-customers", page, typeFilter, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (typeFilter === "company") query = query.eq("is_company", true);
      if (typeFilter === "individual") query = query.eq("is_company", false);
      if (dateFrom) query = query.gte("created_at", dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { customers: data ?? [], total: count ?? 0 };
    },
  });

  const customers = resData?.customers ?? [];
  const totalCount = resData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* ── Client-side search ──────────────────────────── */

  const filtered = search
    ? customers.filter((c: any) => {
        const q = search.toLowerCase();
        const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
        return (
          fullName.includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.license_number ?? "").toLowerCase().includes(q)
        );
      })
    : customers;

  /* ── Edit modal ──────────────────────────────────── */

  const openEdit = (customer: any) => {
    setEditCustomer(customer);
    setEditForm({
      first_name: customer.first_name ?? "",
      last_name: customer.last_name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      id_type: customer.id_type ?? "",
      id_number: customer.id_number ?? "",
      nationality: customer.nationality ?? "",
      license_number: customer.license_number ?? "",
      license_expiry: customer.license_expiry ?? "",
      is_company: customer.is_company ?? false,
      company_name: customer.company_name ?? "",
      company_vat: customer.company_vat ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!user || !editCustomer) return;
    if (!editForm.first_name.trim() || !editForm.last_name.trim() || !editForm.email.trim()) {
      toast({ title: "Nombre, apellidos y email son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        id_type: editForm.id_type || null,
        id_number: editForm.id_number.trim() || null,
        nationality: editForm.nationality.trim() || null,
        license_number: editForm.license_number.trim() || null,
        license_expiry: editForm.license_expiry || null,
        is_company: editForm.is_company,
        company_name: editForm.is_company ? editForm.company_name.trim() || null : null,
        company_vat: editForm.is_company ? editForm.company_vat.trim() || null : null,
      };

      const { error } = await supabase.from("customers").update(payload).eq("id", editCustomer.id);
      if (error) throw error;

      // Build old_data from editCustomer
      const oldData: any = {};
      const newData: any = {};
      for (const key of Object.keys(payload)) {
        if (editCustomer[key] !== payload[key]) {
          oldData[key] = editCustomer[key];
          newData[key] = payload[key];
        }
      }

      await writeAudit(user.id, "update", "customers", editCustomer.id, oldData, newData);
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      toast({ title: "Cliente actualizado" });
      setEditOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Reset filters ───────────────────────────────── */

  const resetFilters = () => {
    setTypeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearch("");
    setPage(0);
  };

  /* ── Render ──────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Buscar nombre, email, teléfono, licencia…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="individual">Particulares</SelectItem>
            <SelectItem value="company">Empresas</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yy") : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} locale={es} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yy") : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} locale={es} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {(typeFilter !== "all" || dateFrom || dateTo || search) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>Limpiar filtros</Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Nº Licencia</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Fecha registro</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No se encontraron clientes.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.license_number ?? "—"}</TableCell>
                  <TableCell>{c.is_company ? c.company_name ?? "Sí" : "—"}</TableCell>
                  <TableCell>{c.created_at ? format(parseISO(c.created_at), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/clientes/${c.id}`)}>
                        <Eye className="h-4 w-4 mr-1" /> Ver
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {totalCount} cliente{totalCount !== 1 ? "s" : ""} · Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={editForm.first_name ?? ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Apellidos *</Label>
                <Input value={editForm.last_name ?? ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={editForm.phone ?? ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo documento</Label>
                <Select value={editForm.id_type ?? ""} onValueChange={(v) => setEditForm({ ...editForm, id_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº documento</Label>
                <Input value={editForm.id_number ?? ""} onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Nacionalidad</Label>
              <Input value={editForm.nationality ?? ""} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nº licencia conducir</Label>
                <Input value={editForm.license_number ?? ""} onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })} />
              </div>
              <div>
                <Label>Caducidad carnet</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editForm.license_expiry && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {editForm.license_expiry ? format(parseISO(editForm.license_expiry), "dd/MM/yyyy") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editForm.license_expiry ? parseISO(editForm.license_expiry) : undefined}
                      onSelect={(d) => setEditForm({ ...editForm, license_expiry: d ? format(d, "yyyy-MM-dd") : "" })}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch checked={editForm.is_company ?? false} onCheckedChange={(v) => setEditForm({ ...editForm, is_company: v })} />
              <Label>¿Es empresa?</Label>
            </div>

            {editForm.is_company && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre empresa</Label>
                  <Input value={editForm.company_name ?? ""} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} />
                </div>
                <div>
                  <Label>CIF/VAT</Label>
                  <Input value={editForm.company_vat ?? ""} onChange={(e) => setEditForm({ ...editForm, company_vat: e.target.value })} />
                </div>
              </div>
            )}

            <Button onClick={saveEdit} disabled={saving} className="mt-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              GUARDAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
