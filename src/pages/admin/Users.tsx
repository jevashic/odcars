import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Plus, Pencil, Loader2, Search, Copy, Check } from "lucide-react";

/* ── Types ──────────────────────────────────────────── */

interface InternalUser {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

interface UserForm {
  full_name: string;
  email: string;
  password: string;
  role: string;
  branch_id: string;
  is_active: boolean;
}

const emptyForm: UserForm = {
  full_name: "",
  email: "",
  password: "",
  role: "employee",
  branch_id: "",
  is_active: true,
};

/* ── Helpers ────────────────────────────────────────── */

function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const symbols = "!@#$%&*";
  let pwd = "";
  for (let i = 0; i < length - 1; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  return pwd;
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-red-100 text-red-800 border-red-200" },
  manager: { label: "Manager", className: "bg-blue-100 text-blue-800 border-blue-200" },
  employee: { label: "Empleado", className: "bg-green-100 text-green-800 border-green-200" },
};

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

export default function AdminUsers() {
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterRole, setFilterRole] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [search, setSearch] = useState("");

  // Password reveal dialog
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [createdPassword, setCreatedPassword] = useState("");
  const [createdEmail, setCreatedEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const isAdmin = user?.role === "admin";

  /* ── Queries ─────────────────────────────────────── */

  const { data: users = [], isLoading } = useQuery<InternalUser[]>({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_users")
        .select("id, auth_user_id, full_name, email, role, branch_id, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["admin-branches-active"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, is_active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const branchMap = useMemo(() => {
    const m: Record<string, string> = {};
    branches.forEach((b) => (m[b.id] = b.name));
    return m;
  }, [branches]);

  const activeBranches = useMemo(() => branches.filter((b) => b.is_active), [branches]);

  /* ── Filtered list ───────────────────────────────── */

  const filtered = useMemo(() => {
    let list = users;
    if (filterRole !== "all") list = list.filter((u) => u.role === filterRole);
    if (filterBranch !== "all") list = list.filter((u) => u.branch_id === filterBranch);
    if (filterActive !== "all") list = list.filter((u) => (filterActive === "active" ? u.is_active : !u.is_active));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.full_name ?? "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filterRole, filterBranch, filterActive, search]);

  /* ── Open modals ──────────────────────────────────── */

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ ...emptyForm, password: generatePassword() });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((u: InternalUser) => {
    setEditingId(u.id);
    setForm({
      full_name: u.full_name ?? "",
      email: u.email,
      password: "",
      role: u.role,
      branch_id: u.branch_id ?? "",
      is_active: u.is_active,
    });
    setModalOpen(true);
  }, []);

  /* ── Create user ─────────────────────────────────── */

  const createUser = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Campo obligatorio", description: "El nombre es requerido.", variant: "destructive" });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: "Campo obligatorio", description: "El email es requerido.", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: "Contraseña inválida", description: "Mínimo 8 caracteres.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario en Auth");

      const { error: dbError } = await supabase.from("internal_users").insert({
        auth_user_id: authData.user.id,
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        role: form.role,
        branch_id: form.branch_id || null,
        is_active: form.is_active,
      });

      if (dbError) throw dbError;

      if (user) await writeAudit(user.id, "insert", "internal_users", authData.user.id, null, { email: form.email.trim(), role: form.role });

      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setModalOpen(false);

      // Show password dialog
      setCreatedEmail(form.email);
      setCreatedPassword(form.password);
      setCopied(false);
      setPwdDialogOpen(true);

      toast({ title: "Usuario creado correctamente" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Update user ─────────────────────────────────── */

  const updateUser = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Campo obligatorio", description: "El nombre es requerido.", variant: "destructive" });
      return;
    }
    if (!editingId) return;

    setSaving(true);
    try {
      const oldUser = users.find((u) => u.id === editingId);
      const payload = {
        full_name: form.full_name.trim(),
        role: form.role,
        branch_id: form.branch_id || null,
        is_active: form.is_active,
      };

      const { error } = await supabase.from("internal_users").update(payload).eq("id", editingId);
      if (error) throw error;

      if (user) await writeAudit(user.id, "update", "internal_users", editingId, oldUser, { ...oldUser, ...payload });

      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setModalOpen(false);
      toast({ title: "Usuario actualizado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Deactivate ──────────────────────────────────── */

  const deactivate = async (u: InternalUser) => {
    try {
      const { error } = await supabase.from("internal_users").update({ is_active: false }).eq("id", u.id);
      if (error) throw error;
      if (user) await writeAudit(user.id, "update", "internal_users", u.id, u, { ...u, is_active: false });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Usuario desactivado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  /* ── Copy password ───────────────────────────────── */

  const copyPassword = async () => {
    await navigator.clipboard.writeText(createdPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Render ───────────────────────────────────────── */

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-primary mb-4">Usuarios</h1>
        <div className="bg-background rounded-xl p-8 shadow-sm border text-center">
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Usuarios</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo usuario
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="employee">Empleado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger><SelectValue placeholder="Oficina" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las oficinas</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-background rounded-xl shadow-sm border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No se encontraron usuarios.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Oficina</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead>Fecha alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const rb = ROLE_BADGE[u.role] ?? { label: u.role, className: "" };
                return (
                  <TableRow key={u.id} className={!u.is_active ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={rb.className}>{rb.label}</Badge>
                    </TableCell>
                    <TableCell>{u.branch_id ? branchMap[u.branch_id] ?? "—" : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "default" : "secondary"}>
                        {u.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(u.created_at).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      {u.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => deactivate(u)}>
                          Desactivar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos del usuario." : "Rellena los datos del nuevo usuario."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nombre completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Nombre y apellidos"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@empresa.com"
                disabled={!!editingId}
              />
            </div>

            {/* Password (only on create) */}
            {!editingId && (
              <div className="space-y-1.5">
                <Label>Contraseña temporal</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                  >
                    Generar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
              </div>
            )}

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Rol *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Empleado</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Branch */}
            <div className="space-y-1.5">
              <Label>Oficina asignada</Label>
              <Select value={form.branch_id || "none"} onValueChange={(v) => setForm({ ...form, branch_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {activeBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active */}
            <div className="flex items-center justify-between">
              <Label>Activo</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <Button
              className="w-full"
              onClick={editingId ? updateUser : createUser}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "GUARDAR" : "CREAR USUARIO"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password reveal dialog */}
      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Usuario creado</DialogTitle>
            <DialogDescription>
              Comunica estas credenciales al usuario. La contraseña no se podrá ver de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="font-medium">{createdEmail}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contraseña temporal</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">{createdPassword}</code>
                <Button variant="outline" size="icon" onClick={copyPassword}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setPwdDialogOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
