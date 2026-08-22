import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { initCloudSync } from "./data/cloud";

/* ⏳ ستنى المزامنة السحابية (2.5s max) من غير ما يبان التطبيق — باش كل جهاز يشد آخر داتا */
Promise.race([
  initCloudSync(),
  new Promise((r) => setTimeout(r, 2500)),
] as Promise<unknown>[]).then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
});
