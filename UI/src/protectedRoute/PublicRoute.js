import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
// Import your Redux store or hooks if you are reading auth state directly from Redux
// import { useSelector } from 'react-redux';

const PublicRoute = () => {
  // Replace this with your actual authentication check
  // (e.g., reading from Redux state, localStorage, or sessionStorage)
  const isUserAuthenticated = localStorage.getItem("isUserAuthenticated") === "true"; 
  
  // If authenticated, redirect to dashboard. Otherwise, render the public route.
  return isUserAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

export default PublicRoute;