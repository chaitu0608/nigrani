import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import "./index.css";
import { AppShell } from "./components/AppShell";
import { useTheme } from "./lib/hooks";
const Overview = lazy(() => import("./pages/Overview"));
const Queue = lazy(() => import("./pages/Queue"));
const Cases = lazy(() => import("./pages/Cases"));
const Model = lazy(() => import("./pages/Model"));
const Landing = lazy(() => import("./pages/Landing"));

function App() {
  const { dark } = useTheme();
  return (
    <TooltipProvider delayDuration={200}>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<AppShell />}>
              <Route index element={<Overview />} />
              <Route path="queue" element={<Queue />} />
              <Route path="queue/:id" element={<Queue />} />
              <Route path="cases" element={<Cases />} />
              <Route path="model" element={<Model />} />
            </Route>
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster theme={dark ? "dark" : "light"} position="bottom-right" toastOptions={{ classNames: { toast: "!bg-bg-2 !border-line-2 !text-fg !rounded-xl !shadow-2xl", description: "!text-fg-3" } }} />
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
