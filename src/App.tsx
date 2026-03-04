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
import AdminReports from "./pages/admin/Reports";
import AdminInvoices from "./pages/admin/Invoices";
import AdminInvoiceDetail from "./pages/admin/InvoiceDetail";
import AdminCategories from "./pages/admin/Categories";
import NewReservation from "./pages/admin/NewReservation";
import AdminReservations from "./pages/admin/Reservations";
import AdminReservationDetail from "./pages/admin/ReservationDetail";
import AdminVehicleCategories from "./pages/admin/VehicleCategories";
import AdminVehiclesByCategory from "./pages/admin/VehiclesByCategory";

import AdminExtras from "./pages/admin/Extras";
import AdminDiscounts from "./pages/admin/Discounts";
import AdminInsurance from "./pages/admin/Insurance";
import AdminCustomers from "./pages/admin/Customers";
import AdminCustomerDetail from "./pages/admin/CustomerDetail";
import AdminBranches from "./pages/admin/Branches";
import AdminUsers from "./pages/admin/Users";
import AdminContentManagement from "./pages/admin/ContentManagement";
import TouristPlaces from "./pages/admin/TouristPlaces";
import AdminNewsletter from "./pages/admin/Newsletter";
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
              <Route path="/admin/reservas/nueva" element={<NewReservation />} />
              <Route path="/admin/reservas/:id" element={<AdminReservationDetail />} />
              <Route path="/admin/reservas" element={<AdminReservations />} />
              <Route path="/admin/vehiculos" element={<AdminVehicleCategories />} />
              <Route path="/admin/vehiculos/:categoryId" element={<AdminVehiclesByCategory />} />
              <Route path="/admin/categorias" element={<AdminCategories />} />
              <Route path="/admin/precios" element={<AdminStub />} />
              <Route path="/admin/extras" element={<AdminExtras />} />
              <Route path="/admin/descuentos" element={<AdminDiscounts />} />
              <Route path="/admin/clientes" element={<AdminCustomers />} />
              <Route path="/admin/clientes/:id" element={<AdminCustomerDetail />} />
              <Route path="/admin/oficinas" element={<AdminBranches />} />
              <Route path="/admin/usuarios" element={<AdminUsers />} />
              <Route path="/admin/contenido/*" element={<AdminContentManagement />} />
              <Route path="/admin/conoce-gran-canaria" element={<TouristPlaces />} />
              <Route path="/admin/chat" element={<AdminStub />} />
              <Route path="/admin/seguros" element={<AdminInsurance />} />
              <Route path="/admin/newsletter" element={<AdminNewsletter />} />
              <Route path="/admin/branding" element={<AdminStub />} />
              <Route path="/admin/configuracion" element={<AdminStub />} />
              <Route path="/admin/informes" element={<AdminReports />} />
              <Route path="/admin/facturacion" element={<AdminInvoices />} />
              <Route path="/admin/facturacion/:id" element={<AdminInvoiceDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ConfigProvider>
  </QueryClientProvider>
);

export default App;
