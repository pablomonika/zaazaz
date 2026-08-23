import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { initCloudSync } from "./data/cloud";

/* ⏳ استنى المزامنة السحابية تكمّل قبل ما يبان التطبيق
   (باش اليوزرات من السيرفر يكونو موجودين قبل الـ Login)
   إلا فشلت → التطبيق كيخدم محلي عادي */
initCloudSync().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
});
