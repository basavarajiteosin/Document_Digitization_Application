import axios from "axios";
import reduxStore from "../reduxStorage/combinedReducers";

// This patches the shared `axios` module instance that every component already
// imports (`import axios from "axios"`), so every existing axios.get/post/etc.
// call across the app automatically gets the Authorization header - no need to
// touch individual API calls or add a separate axios instance everywhere.

// ---------- REQUEST: attach the bearer token to every outgoing call ----------
axios.interceptors.request.use(
  (requestConfig) => {
    try {
      const state = reduxStore.getState();
      const token = state?.personalInformationReducer?.token;

      if (token) {
        requestConfig.headers = {
          ...requestConfig.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    } catch (error) {
      // If the store isn't ready yet for any reason, let the request go out
      // without a token rather than blocking the whole app.
      console.error("Error attaching auth token to request:", error);
    }

    return requestConfig;
  },
  (error) => Promise.reject(error)
);

// ---------- RESPONSE: centrally handle an expired/invalid session ----------
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("isUserAuthenticated");
      localStorage.removeItem("user_id");
      localStorage.removeItem("persist:pmo_user");

      // Avoid redirect loops if we're already on the login page.
      if (!window.location.pathname.endsWith("/login")) {
        window.location.href = `${window.location.origin}/dda_qas/login`;
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
