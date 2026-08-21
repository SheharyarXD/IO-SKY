/*
 * IO SKY — App router.
 * Forces dark mission-control theme app-wide and wires up every route the
 * navbar/footer can produce so no link dead-ends.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import MfaChallenge from "@/pages/MfaChallenge";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import PortalErrorBoundary from "./components/PortalErrorBoundary";
import RouteTransition from "./components/RouteTransition";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import About from "./pages/About";
import Solutions from "./pages/Solutions";
import GrowthEcosystem from "./pages/solutions/GrowthEcosystem";
import EliteEcosystem from "./pages/solutions/EliteEcosystem";
import CustomIntelligence from "./pages/solutions/CustomIntelligence";
import ProposalRequest from "./pages/solutions/ProposalRequest";
import BookingAction from "./pages/BookingAction";
import Infrastructure from "./pages/Infrastructure";
import Intelligence from "./pages/Intelligence";
import AIScan from "./pages/AIScan";
import AIScanStart from "./pages/AIScanStart";
import AIScanResult from "./pages/AIScanResult";
import BookStrategy from "./pages/BookStrategy";
import Contact from "./pages/Contact";
import EngineeringAccess from "./pages/EngineeringAccess";
import Portal from "./pages/Portal";
import Security from "./pages/Security";
import Legal from "./pages/Legal";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import Enterprise from "./pages/Enterprise";
import CustomSoftware from "./pages/CustomSoftware";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Translations from "./pages/Translations";
import { LanguageProvider } from "./contexts/LanguageContext";
import HashScroll from "./components/HashScroll";
import AdminBookings from "./pages/AdminBookings";
import AdminPortal from "./pages/admin/AdminPortal";
import ClientPortal from "./pages/client-portal/ClientPortal";
import DeveloperWorkspace from "./pages/developer-workspace/DeveloperWorkspace";
import OpsConsole from "./pages/ops/OpsConsole";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <>
    <HashScroll />
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/solutions" component={Solutions} />
      <Route path="/solutions/growth-ecosystem" component={GrowthEcosystem} />
      <Route path="/solutions/elite-ecosystem" component={EliteEcosystem} />
      <Route path="/solutions/custom-intelligence-infrastructure" component={CustomIntelligence} />
      <Route path="/solutions/proposal-request" component={ProposalRequest} />
      <Route path="/infrastructure" component={Infrastructure} />
      <Route path="/intelligence" component={Intelligence} />
      <Route path="/enterprise" component={Enterprise} />
      <Route path="/custom-software" component={CustomSoftware} />
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/mfa-challenge" component={MfaChallenge} />
      <Route path="/translations" component={Translations} />
      <Route path="/ai-scan" component={AIScan} />
      <Route path="/ai-scan/start" component={AIScanStart} />
      <Route path="/ai-scan/result/:token" component={AIScanResult} />
      <Route path="/book-strategy" component={BookStrategy} />
      <Route path="/booking/cancel" component={BookingAction} />
      <Route path="/booking/reschedule" component={BookingAction} />
      <Route path="/contact" component={Contact} />
      <Route path="/engineering-access" component={EngineeringAccess} />
      <Route path="/portal/client">{() => <Portal role="client" />}</Route>
      <Route path="/portal/admin">{() => <Portal role="admin" />}</Route>
      <Route path="/portal/developer">{() => <Portal role="developer" />}</Route>
      <Route path="/admin" component={() => <PortalErrorBoundary><AdminPortal /></PortalErrorBoundary>} />
      <Route path="/admin/bookings" component={() => <PortalErrorBoundary><AdminPortal /></PortalErrorBoundary>} />
      <Route path="/admin/:section*" component={() => <PortalErrorBoundary><AdminPortal /></PortalErrorBoundary>} />
      <Route path="/client-portal/:section*" component={() => <PortalErrorBoundary><ClientPortal /></PortalErrorBoundary>} />
      <Route path="/client-portal" component={() => <PortalErrorBoundary><ClientPortal /></PortalErrorBoundary>} />
      <Route path="/developer-workspace/:section*" component={() => <PortalErrorBoundary><DeveloperWorkspace /></PortalErrorBoundary>} />
      <Route path="/developer-workspace" component={() => <PortalErrorBoundary><DeveloperWorkspace /></PortalErrorBoundary>} />
      <Route path="/ops" component={() => <PortalErrorBoundary><OpsConsole /></PortalErrorBoundary>} />
      <Route path="/security" component={Security} />
      <Route path="/legal/:doc" component={Legal} />
      <Route path="/privacy"><Legal /></Route>
      <Route path="/terms"><Legal /></Route>
      <Route path="/cookies"><Legal /></Route>
      <Route path="/ai-disclaimer"><Legal /></Route>
      <Route path="/dpa"><Legal /></Route>
      <Route path="/trust"><Legal /></Route>
      <Route path="/status"><Legal /></Route>
      <Route path="/careers"><Legal /></Route>
      <Route path="/press"><Legal /></Route>
      <Route path="/partners"><Legal /></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
        <TooltipProvider>
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(15,21,33,0.92)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgb(232,236,244)",
                backdropFilter: "blur(12px)",
              },
            }}
          />
          <PortalErrorBoundary>
            <RouteTransition>
              <Router />
            </RouteTransition>
          </PortalErrorBoundary>
          <CookieConsentBanner />
        </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
