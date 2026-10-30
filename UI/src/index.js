import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/sp-theme.css";
import "./styles/sp-library.css";
import "./styles/sp-pages.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import "./services/axiosInterceptor";

document.body.classList.add("sp-theme");

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter basename="/dda">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();