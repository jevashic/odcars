import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import '@/i18n';

import Index from "./pages/Index";
import Fleet from "./pages/Fleet";
import OffersPage from "./pages/OffersPage";
import DiscoverGC from "./pages/DiscoverGC";
import PlaceDetail from "./pages/PlaceDetail";
import Contact from "./pages/Contact";
import MyReservations from "./pages/MyReservations";

import SearchResults from "./pages/booking/SearchResults";
import VehicleDetail from "./pages/booking/VehicleDetail";
import Extras from "./pages/booking/Extras";
import Summary from "./pages/booking/Summary";
import Payment from "./pages/booking/Payment";
import Confirmation from "./pages/booking/Confirmation";

import LegalPage from "./pages/legal/LegalPage";

import AdminLogin from "./pages/admin/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminStub from "./pages/admin/AdminStub";

import AdminInsurance from "./pages/admin/Insurance";
import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

function LangRoutes() {
  return (
    <LanguageProvider>
      <Routes>
        <Route index element={<Index />} />
        <Route path="flota" element={<Fleet />} />
        <Route path="ofertas" element={<OffersPage />} />
        <Route path="conoce-gran-canaria" element={<DiscoverGC />} />
        <Route path="conoce-gran-canaria/:slug" element={<PlaceDetail />} />
        <Route path="contacto" element={<Contact />} />
        <Route path="mis-reservas" element={<MyReservations />} />

        {/* Booking flow */}
        <Route path="reservar" element={<SearchResults />} />
        <Route path="reservar/detalle/:categoryId" element={<VehicleDetail />} />
        <Route path="reservar/extras" element={<Extras />} />
        <Route path="reservar/resumen" element={<Summary />} />
        <Route path="reservar/pago" element={<Payment />} />
        <Route path="reservar/confirmacion" element={<Confirmation />} />

        {/* Legal */}
        <Route path="legal/:type" element={<LegalPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </LanguageProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ConfigProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Redirect root to /es/ */}
            <Route path="/" element={<Navigate to="/es" replace />} />

            {/* Lang-prefixed public routes */}
            <Route path="/:lang/*" element={<LangRoutes />} />

            {/* Admin routes (no lang prefix) */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/reservas" element={<AdminStub />} />
              <Route path="/admin/vehiculos" element={<AdminStub />} />
              <Route path="/admin/categorias" element={<AdminStub />} />
              <Route path="/admin/precios" element={<AdminStub />} />
              <Route path="/admin/extras" element={<AdminStub />} />
              <Route path="/admin/descuentos" element={<AdminStub />} />
              <Route path="/admin/clientes" element={<AdminStub />} />
              <Route path="/admin/oficinas" element={<AdminStub />} />
              <Route path="/admin/usuarios" element={<AdminStub />} />
              <Route path="/admin/contenido/*" element={<AdminStub />} />
              <Route path="/admin/chat" element={<AdminStub />} />
              <Route path="/admin/seguros" element={<AdminInsurance />} />
              <Route path="/admin/newsletter" element={<AdminStub />} />
              <Route path="/admin/branding" element={<AdminStub />} />
              <Route path="/admin/configuracion" element={<AdminStub />} />
              <Route path="/admin/informes" element={<AdminStub />} />
              <Route path="/admin/facturacion" element={<AdminStub />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ConfigProvider>
  </QueryClientProvider>
);

export default App;
