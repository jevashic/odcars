import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, Save, Palette, Image, Building2, Settings2 } from "lucide-react";

/* ── Types ──────────────────────────────────── */

interface BrandRow {
  id: string;
  key: string;
  value: string;
  config_type: string;
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

/* ── Label maps ─────────────────────────────── */

const COLOR_LABELS: Record<string, string> = {
  color_primary: "Color primario (azul navy)",
  color_secondary: "Color secundario (azul medio)",
  color_cta: "Color botones CTA (amarillo)",
  color_navbar_bg: "Fondo navbar",
  color_footer_bg: "Fondo footer",
  color_text_dark: "Color texto principal",
};

const IMAGE_LABELS: Record<string, string> = {
  logo_url: "URL del logo",
  favicon_url: "URL del favicon",
};

const TEXT_LABELS: Record<string, string> = {
  company_name: "Nombre empresa",
  company_phone: "Teléfono principal",
  company_email: "Email principal",
  company_address: "Dirección",
  social_facebook: "URL Facebook",
  social_instagram: "URL Instagram",
  social_twitter: "URL Twitter/X",
};

const BOOLEAN_LABELS: Record<string, string> = {
  show_chat: "Mostrar chat en la web",
};

/* ── Component ──────────────────────────────── */

export default function AdminBranding() {
  const { user } = useAdminAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const [local, setLocal] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  /* ── Query ─────────────────────────────────── */

  const { data: rows = [], isLoading, error: queryError } = useQuery<BrandRow[]>({
    queryKey: ["admin-branding"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_config")
        .select("*")
        .order("key");
      if (error) throw new Error(error.message);
      return data as BrandRow[];
    },
  });

  // Sync local state when data loads
  useEffect(() => {
    if (rows.length > 0) {
      const m: Record<string, string> = {};
      rows.forEach((r) => { m[r.key] = r.value ?? ""; });
      setLocal(m);
      setDirty({});
    }
  }, [rows]);

  /* ── Helpers ───────────────────────────────── */

  const getRow = useCallback((key: string) => rows.find((r) => r.key === key), [rows]);

  const setValue = (key: string, value: string, section: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => {
      const s = new Set(prev[section] ?? []);
      s.add(key);
      return { ...prev, [section]: s };
    });
  };

  /* ── Save section ──────────────────────────── */

  const saveSection = async (section: string, keys: string[]) => {
    const changedKeys = keys.filter((k) => dirty[section]?.has(k));
    if (changedKeys.length === 0) {
      toast({ title: "Sin cambios" });
      return;
    }

    setSaving(section);
    try {
      for (const key of changedKeys) {
        const row = getRow(key);
        if (!row) continue;
        const oldValue = row.value;
        const newValue = local[key] ?? "";
        const { error } = await supabase
          .from("brand_config")
          .update({ value: newValue })
          .eq("key", key);
        if (error) throw error;
        if (user) {
          await writeAudit(user.id, "update", "brand_config", row.id, { key, value: oldValue }, { key, value: newValue });
        }
      }
      toast({ title: "Cambios guardados" });
      setDirty((prev) => ({ ...prev, [section]: new Set() }));
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  /* ── Upload image ──────────────────────────── */

  const handleImageUpload = async (key: string, file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/)) {
      toast({ title: "Formato no válido", description: "Solo JPG, PNG, WebP, SVG o ICO.", variant: "destructive" });
      return;
    }
    setUploading(key);
    try {
      const ext = file.name.split(".").pop();
      const path = `${key}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
      const url = urlData.publicUrl;

      // Update DB directly
      const row = getRow(key);
      if (row) {
        const { error: updErr } = await supabase.from("brand_config").update({ value: url }).eq("key", key);
        if (updErr) throw updErr;
        if (user) await writeAudit(user.id, "update", "brand_config", row.id, { key, value: row.value }, { key, value: url });
      }

      setLocal((prev) => ({ ...prev, [key]: url }));
      toast({ title: "Imagen subida correctamente" });
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
    } catch (err: any) {
      toast({ title: "Error subiendo imagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  /* ── Grouped data ──────────────────────────── */

  const colorKeys = Object.keys(COLOR_LABELS).filter((k) => getRow(k));
  const imageKeys = Object.keys(IMAGE_LABELS).filter((k) => getRow(k));
  const textKeys = Object.keys(TEXT_LABELS).filter((k) => getRow(k));
  const booleanKeys = Object.keys(BOOLEAN_LABELS).filter((k) => getRow(k));

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
        <h1 className="text-2xl font-bold text-primary mb-4">Branding</h1>
        <div className="bg-destructive/10 rounded-xl p-8 shadow-sm border border-destructive text-center">
          <p className="text-destructive font-medium">Error al cargar configuración: {queryError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Branding</h1>

      {/* ── COLORES ─────────────────────────────── */}
      {colorKeys.length > 0 && (
        <SectionCard
          icon={<Palette className="h-5 w-5" />}
          title="Colores"
          saving={saving === "color"}
          onSave={() => saveSection("color", colorKeys)}
          hasDirty={(dirty["color"]?.size ?? 0) > 0}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {colorKeys.map((key) => (
              <div key={key} className="space-y-2">
                <Label className="text-sm font-medium">{COLOR_LABELS[key]}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={local[key] || "#000000"}
                    onChange={(e) => setValue(key, e.target.value, "color")}
                    className="h-10 w-14 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={local[key] || ""}
                    onChange={(e) => setValue(key, e.target.value, "color")}
                    placeholder="#000000"
                    className="font-mono text-sm flex-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── IMÁGENES ────────────────────────────── */}
      {imageKeys.length > 0 && (
        <SectionCard
          icon={<Image className="h-5 w-5" />}
          title="Imágenes"
          saving={false}
          onSave={() => {}}
          hideButton
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {imageKeys.map((key) => (
              <div key={key} className="space-y-3">
                <Label className="text-sm font-medium">{IMAGE_LABELS[key]}</Label>
                {local[key] && (
                  <div className="border border-border rounded-lg p-2 bg-muted/30 flex items-center justify-center">
                    <img src={local[key]} alt={key} className="max-h-20 object-contain" />
                  </div>
                )}
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file) handleImageUpload(key, file);
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleImageUpload(key, file);
                    };
                    input.click();
                  }}
                >
                  {uploading === key ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Arrastra o haz clic para subir</p>
                    </>
                  )}
                </div>
                <Input
                  value={local[key] || ""}
                  onChange={(e) => setValue(key, e.target.value, "image")}
                  placeholder="https://..."
                  className="text-xs font-mono"
                  readOnly
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── EMPRESA ─────────────────────────────── */}
      {textKeys.length > 0 && (
        <SectionCard
          icon={<Building2 className="h-5 w-5" />}
          title="Empresa"
          saving={saving === "text"}
          onSave={() => saveSection("text", textKeys)}
          hasDirty={(dirty["text"]?.size ?? 0) > 0}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {textKeys.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm font-medium">{TEXT_LABELS[key]}</Label>
                <Input
                  value={local[key] || ""}
                  onChange={(e) => setValue(key, e.target.value, "text")}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── OPCIONES ────────────────────────────── */}
      {booleanKeys.length > 0 && (
        <SectionCard
          icon={<Settings2 className="h-5 w-5" />}
          title="Opciones"
          saving={saving === "boolean"}
          onSave={() => saveSection("boolean", booleanKeys)}
          hasDirty={(dirty["boolean"]?.size ?? 0) > 0}
        >
          <div className="space-y-4">
            {booleanKeys.map((key) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-sm font-medium">{BOOLEAN_LABELS[key]}</Label>
                <Switch
                  checked={local[key] === "true"}
                  onCheckedChange={(v) => setValue(key, v ? "true" : "false", "boolean")}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ── Section card component ──────────────────── */

function SectionCard({
  icon, title, children, saving, onSave, hasDirty, hideButton,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  saving: boolean | string | null;
  onSave: () => void;
  hasDirty?: boolean;
  hideButton?: boolean;
}) {
  return (
    <div className="bg-background rounded-xl border shadow-sm mb-6">
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
      {!hideButton && (
        <div className="px-6 pb-5 flex justify-end">
          <Button onClick={onSave} disabled={!!saving || !hasDirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
}
