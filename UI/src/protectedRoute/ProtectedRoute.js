import React from "react";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
    let isAuthenticated = localStorage.getItem('isUserAuthenticated');
    let persist = localStorage.getItem("persist:pmo_user");
    return isAuthenticated === "true" && persist ? <Outlet /> : <Navigate to="/login" />;
}

export default ProtectedRoute;