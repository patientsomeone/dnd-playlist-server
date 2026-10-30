import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {ReactLists} from "./ReactLists";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing React application root");
createRoot(container).render(<StrictMode><ReactLists/></StrictMode>);
