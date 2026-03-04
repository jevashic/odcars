import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, Trash2, Search, Users, UserCheck, UserX } from "lucide-react";

/* ── Types ──────────────────────────────────── */

interface Subscriber {
  id: string;
  email: string;
  lang: string | null;
  is_active: boolean;
  subscribed_at: string;
  unsubscribed_at: string | null;
  accepts_newsletter: boolean;
  accepts_promotions: boolean;
  ip_address: string | null;
}

/* ── Audit helper ───────────────────────────── */

async function writeAudit(
  userId: string, action: string, tableName: string,
  recordId: string, oldData: unknown, newData: unknown,
) {
  await supabase.from("audit_log").insert({
    performed_by: userId, action, table_name: tableName,
    record_id: recordId, old_data: oldData, new_data: newData,
  });
}

const PAGE_SIZE = 20;

export default function AdminNewsletter() {
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const [filterActive, setFilterActive] = useState("all");
  const [filterLang, setFilterLang] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Query ─────────────────────────────────── */

  const { data: allSubscribers = [], isLoading, error: queryError } = useQuery<Subscriber[]>({
    queryKey: ["admin-newsletter"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("subscribed_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as Subscriber[];
    },
  });

  /* ── Filtered + paginated ──────────────────── */

  const filtered = useMemo(() => {
    return allSubscribers.filter((s) => {
      if (filterActive === "active" && !s.is_active) return false;
      if (filterActive === "inactive" && s.is_active) return false;
      if (filterLang !== "all" && s.lang !== filterLang) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allSubscribers, filterActive, filterLang, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  /* ── Stats ─────────────────────────────────── */

  const stats = useMemo(() => {
    const active = allSubscribers.filter((s) => s.is_active).length;
    return { total: allSubscribers.length, active, inactive: allSubscribers.length - active };
  }, [allSubscribers]);

  /* ── Toggle active ─────────────────────────── */

  const toggleActive = async (sub: Subscriber) => {
    const newVal = !sub.is_active;
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({ is_active: newVal })
      .eq("id", sub.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (user) await writeAudit(user.id, "update", "newsletter_subscribers", sub.id, { is_active: sub.is_active }, { is_active: newVal });
    toast({ title: newVal ? "Suscriptor activado" : "Suscriptor desactivado" });
    qc.invalidateQueries({ queryKey: ["admin-newsletter"] });
  };

  /* ── Delete ────────────────────────────────── */

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "delete", "newsletter_subscribers", deleteTarget.id, deleteTarget, null);
      toast({ title: "Suscriptor eliminado" });
      qc.invalidateQueries({ queryKey: ["admin-newsletter"] });
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  /* ── Export CSV ─────────────────────────────── */

  const exportCSV = () => {
    const active = allSubscribers.filter((s) => s.is_active);
    if (active.length === 0) {
      toast({ title: "No hay suscriptores activos para exportar", variant: "destructive" });
      return;
    }
    const header = "email,idioma,fecha_suscripcion";
    const rows = active.map((s) =>
      [
        `"${s.email}"`,
        s.lang ?? "",
        s.subscribed_at ? new Date(s.subscribed_at).toLocaleDateString("es-ES") : "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suscriptores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${active.length} suscriptores exportados` });
  };

  /* ── Render ────────────────────────────────── */

  if (!isAdmin) return <p className="p-8 text-muted-foreground">Acceso restringido a administradores.</p>;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (queryError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Newsletter</h1>
        <div className="bg-destructive/10 rounded-xl p-8 shadow-sm border border-destructive text-center">
          <p className="text-destructive font-medium">Error al cargar suscriptores: {queryError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Newsletter</h1>
        <Button onClick={exportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-background rounded-xl border p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
        </div>
        <div className="bg-background rounded-xl border p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
            <p className="text-sm text-muted-foreground">Activos</p>
          </div>
        </div>
        <div className="bg-background rounded-xl border p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <UserX className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.inactive}</p>
            <p className="text-sm text-muted-foreground">Inactivos</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar email o nombre…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 w-[240px]"
          />
        </div>
        <Select value={filterActive} onValueChange={handleFilterChange(setFilterActive)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLang} onValueChange={handleFilterChange(setFilterLang)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Idioma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="es">ES</SelectItem>
            <SelectItem value="en">EN</SelectItem>
            <SelectItem value="de">DE</SelectItem>
            <SelectItem value="sv">SV</SelectItem>
            <SelectItem value="no">NO</SelectItem>
            <SelectItem value="fr">FR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-background rounded-xl p-8 shadow-sm border text-center">
          <p className="text-muted-foreground">No hay suscriptores.</p>
        </div>
      ) : (
        <div className="bg-background rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Newsletter</TableHead>
                <TableHead>Idioma</TableHead>
                <TableHead>Fecha suscripción</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.email}</TableCell>
                  <TableCell>{sub.accepts_newsletter ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{(sub.lang ?? "—").toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch checked={sub.is_active} onCheckedChange={() => toggleActive(sub)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(sub)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar suscriptor</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar a <strong>{deleteTarget?.email}</strong>? Esta acción no se puede deshacer (derecho al olvido / GDPR).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
