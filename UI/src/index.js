import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
// Registers axios request/response interceptors (global auth token + 401 handling)
// once, before any component in the app makes an API call.
import "./services/axiosInterceptor";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter basename="/dda">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();