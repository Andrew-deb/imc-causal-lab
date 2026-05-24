import { createRoot } from "react-dom/client";
import { ClerkProviderWrapper } from "./lib/auth-wrapper";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ClerkProviderWrapper>
    <App />
  </ClerkProviderWrapper>
);
