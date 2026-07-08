import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initViewportHeight } from "./lib/viewport-height";
import "./styles/globals.scss";

initViewportHeight();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
