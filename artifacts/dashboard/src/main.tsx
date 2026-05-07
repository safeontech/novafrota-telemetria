import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installApiAuth } from "./lib/api-auth";

installApiAuth();

createRoot(document.getElementById("root")!).render(<App />);
