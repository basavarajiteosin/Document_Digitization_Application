import React from "react";
import { useLocation } from "react-router-dom";
import FolderCreation from "../FoldersCreation/FolderCreation";
import SearchDocuments from "./SearchDocuments";

const DashboardRoute = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);

  if (params.has("q")) {
    return <SearchDocuments key={search} />;
  }
  return <FolderCreation />;
};

export default DashboardRoute;