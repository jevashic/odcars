import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, Loader2, Printer, Send, Ban, FileCheck } from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png";

/* ── Audit helper ───────────────────────────────────── */

async function writeAudit(
  userId: string, action: string, tableName: string,
  recordId: string, oldData: unknown, newData: unknown
) {
  await supabase.from("audit_logs").insert({
    performed_by: userId, action, table_name: tableName,
    record_id: recordId, old_data: oldData as any, new_data: newData as any,
  });
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  issued: { label: "Emitida", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  sent: { label: "Enviada", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  void: { label: "Anulada", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  alquiler: { label: "Alquiler", className: "bg-blue-50 text-blue-700" },
  extra: { label: "Extra", className: "bg-purple-50 text-purple-700" },
  seguro: { label: "Seguro", className: "bg-amber-50 text-amber-700" },
  cargo: { label: "Cargo", className: "bg-red-50 text-red-700" },
};

/* ── Default company data ───────────────────────────── */

const DEFAULT_COMPANY = {
  company_name: "Ocean Drive Rent a Car S.L.",
  cif: "B76543210",
  address: "C/ León y Castillo, 42, 35003 Las Palmas de Gran Canaria",
  igic_number: "GC-00012345",
  invoice_footer_note: "Operación sujeta a IGIC. Factura emitida conforme a la normativa fiscal de Canarias.",
};

/* ── Component ──────────────────────────────────────── */

export default function AdminInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const qc = useQueryClient();

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [acting, setActing] = useState(false);

  /* ── Queries ──────────────────────────────────────── */

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, reservations(reservation_number, pickup_date, return_date), customers(*)`)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: config } = useQuery({
    queryKey: ["accounting-config"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("accounting_config").select("*").single();
        if (error) return DEFAULT_COMPANY;
        return data ?? DEFAULT_COMPANY;
      } catch {
        return DEFAULT_COMPANY;
      }
    },
  });

  const { data: auditRows = [] } = useQuery({
    queryKey: ["invoice-audit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .eq("record_id", id!)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const company = config ?? DEFAULT_COMPANY;
  const lineItems: any[] = invoice?.line_items ?? [];

  /* ── Actions ──────────────────────────────────────── */

  const issueInvoice = async () => {
    if (!invoice || !user) return;
    setActing(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("invoices").update({ status: "issued", issued_at: now }).eq("id", invoice.id);
      if (error) throw error;
      await writeAudit(user.id, "update", "invoices", invoice.id, { status: "draft" }, { status: "issued", issued_at: now });

      // Try edge function (non-blocking)
      try {
        await supabase.functions.invoke("issue_invoice", { body: { invoice_id: invoice.id } });
      } catch {
        toast({ title: "Factura emitida", description: "La función de envío no está configurada. La factura se marcó como emitida." });
      }

      toast({ title: "Factura emitida correctamente" });
      qc.invalidateQueries({ queryKey: ["invoice-detail", id] });
      qc.invalidateQueries({ queryKey: ["invoice-audit", id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const resendInvoice = async () => {
    if (!invoice || !user) return;
    setActing(true);
    try {
      await supabase.functions.invoke("issue_invoice", { body: { invoice_id: invoice.id, resend: true } });
      await writeAudit(user.id, "resend", "invoices", invoice.id, null, { resend: true });
      toast({ title: "Factura reenviada al cliente" });
      qc.invalidateQueries({ queryKey: ["invoice-audit", id] });
    } catch {
      toast({ title: "La función de reenvío no está configurada", variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const voidInvoice = async () => {
    if (!invoice || !user || !voidReason.trim()) return;
    setActing(true);
    try {
      const { error } = await supabase.from("invoices").update({ status: "void", void_reason: voidReason.trim() }).eq("id", invoice.id);
      if (error) throw error;
      await writeAudit(user.id, "update", "invoices", invoice.id, { status: invoice.status }, { status: "void", void_reason: voidReason.trim() });
      toast({ title: "Factura anulada" });
      setVoidOpen(false);
      setVoidReason("");
      qc.invalidateQueries({ queryKey: ["invoice-detail", id] });
      qc.invalidateQueries({ queryKey: ["invoice-audit", id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  /* ── Loading ──────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return <p className="text-center text-muted-foreground py-20">Factura no encontrada.</p>;
  }

  const badge = STATUS_BADGE[invoice.status] ?? STATUS_BADGE.draft;
  const customer = invoice.customers;
  const subtotalGravable = lineItems.reduce((s: number, l: any) => s + (l.base ?? 0), 0);
  const igicTotal = lineItems.reduce((s: number, l: any) => s + (l.igic ?? 0), 0);
  const discount = invoice.discount_amount ?? 0;
  const total = invoice.total_amount ?? subtotalGravable + igicTotal - discount;

  return (
    <div>
      {/* Breadcrumb & back */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/facturacion")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/facturacion">Facturación</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>{invoice.invoice_number}</BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Badge className={badge.className + " ml-auto"}>{badge.label}</Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left column (2/3) ────────────────────────── */}
        <div className="lg:col-span-2 space-y-6" id="invoice-printable">
          {/* Company header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <img src={logoHorizontal} alt="Ocean Drive" className="h-12 object-contain" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{company.company_name}</p>
                  <p>CIF: {company.cif}</p>
                  <p>{company.address}</p>
                  <p>Nº IGIC: {company.igic_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer data */}
          {customer && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Datos del cliente</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                <p>{customer.email}</p>
                {customer.document_number && <p>Documento: {customer.document_number}</p>}
                {customer.address && <p>{customer.address}</p>}
                {customer.is_company && (
                  <>
                    {customer.company_name && <p>Empresa: {customer.company_name}</p>}
                    {customer.company_cif && <p>CIF empresa: {customer.company_cif}</p>}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Invoice data */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de la factura</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Nº factura:</span> <span className="font-mono font-semibold">{invoice.invoice_number}</span></p>
              <p><span className="text-muted-foreground">Fecha de emisión:</span> {invoice.issued_at ? format(new Date(invoice.issued_at), "dd/MM/yyyy") : format(new Date(invoice.created_at), "dd/MM/yyyy")}</p>
              {invoice.reservations && (
                <p>
                  <span className="text-muted-foreground">Reserva vinculada:</span>{" "}
                  <Link to={`/admin/reservas/${invoice.reservation_id}`} className="text-primary hover:underline font-mono">
                    {invoice.reservations.reservation_number}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Líneas de factura</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Base imponible</TableHead>
                    <TableHead className="text-right">IGIC 7%</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin líneas.</TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((item: any, idx: number) => {
                      const tb = TYPE_BADGE[item.type] ?? { label: item.type, className: "bg-gray-50 text-gray-700" };
                      return (
                        <TableRow key={idx}>
                          <TableCell>{item.concept}</TableCell>
                          <TableCell><Badge variant="outline" className={tb.className}>{tb.label}</Badge></TableCell>
                          <TableCell className="text-right">{(item.base ?? 0).toFixed(2)} €</TableCell>
                          <TableCell className="text-right">{(item.igic ?? 0).toFixed(2)} €</TableCell>
                          <TableCell className="text-right font-medium">{(item.total ?? 0).toFixed(2)} €</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="mt-4 border-t pt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal gravable</span>
                  <span>{subtotalGravable.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGIC 7%</span>
                  <span>{igicTotal.toFixed(2)} €</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Descuento aplicado</span>
                    <span>-{discount.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>TOTAL</span>
                  <span>{total.toFixed(2)} €</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              {invoice.payment_method && <p>Método de pago: {invoice.payment_method}</p>}
              {invoice.payment_date && <p>Fecha de pago: {format(new Date(invoice.payment_date), "dd/MM/yyyy")}</p>}
              <p className="mt-2 italic">{company.invoice_footer_note ?? DEFAULT_COMPANY.invoice_footer_note}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Right column (1/3) ───────────────────────── */}
        <div className="space-y-6 print:hidden">
          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.status === "draft" && (
                <Button className="w-full" onClick={issueInvoice} disabled={acting}>
                  {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                  EMITIR FACTURA
                </Button>
              )}

              {(invoice.status === "issued" || invoice.status === "sent") && (
                <>
                  <Button variant="outline" className="w-full" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" /> DESCARGAR PDF
                  </Button>
                  <Button variant="outline" className="w-full" onClick={resendInvoice} disabled={acting}>
                    {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    REENVIAR AL CLIENTE
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => { setVoidOpen(true); setVoidReason(""); }}>
                    <Ban className="h-4 w-4 mr-2" /> ANULAR
                  </Button>
                </>
              )}

              {invoice.status === "void" && (
                <div className="space-y-2">
                  <Badge className="bg-red-100 text-red-800">Anulada</Badge>
                  {invoice.void_reason && (
                    <p className="text-sm text-muted-foreground">Motivo: {invoice.void_reason}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              {auditRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin registros.</p>
              ) : (
                <div className="space-y-3">
                  {auditRows.map((a: any) => (
                    <div key={a.id} className="text-sm border-b pb-2 last:border-0">
                      <p className="text-muted-foreground">{format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}</p>
                      <p className="font-medium capitalize">{a.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Void AlertDialog ──────────────────────────── */}
      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular factura {invoice.invoice_number}</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Motivo de anulación (obligatorio)…" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={voidInvoice} disabled={acting || !voidReason.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {acting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-printable, #invoice-printable * { visibility: visible; }
          #invoice-printable { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
