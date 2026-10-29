
import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  setActiveComponentName,
  setUserPersonalInformation,
} from "../reduxStorage/personalInformation";
import bmsLogoWipro from "../assets/images/wiprosecondary_logo.png";
import { RiMailSettingsFill } from "react-icons/ri";
import { FaUsersGear } from "react-icons/fa6";
import { FaThLarge, FaCogs, FaFolder, FaThList } from "react-icons/fa";
import { TbDatabaseCog } from "react-icons/tb";
import { FaFolderOpen } from "react-icons/fa6";
import { FaMailBulk } from "react-icons/fa";
import { MdStorage } from "react-icons/md";

import { HiOutlineDocumentReport } from "react-icons/hi";
import { PiHardDrivesDuotone } from "react-icons/pi";
import { LuFolderOpen } from "react-icons/lu";


const Menu = () => {
  const dispatch = useDispatch();
  const personalInfo = useSelector((state) => state.personalInformationReducer);
  const [allRoutesList, setAllRoutesList] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setAllRoutesList(personalInfo.menuItemNames);
  }, [personalInfo.menuItemNames]);

  const isPathActive = (path, appName) => {
    const searchParams = new URLSearchParams(location.search);
    const userFilesUserID = searchParams.get("userFilesUserID");
    const userName = searchParams.get("userName");

    // If userFilesUserID and userName are present, don't mark "Create Folder" as active
    if (appName === "Create Folder" && userFilesUserID && userName) {
      return false;
    }

    // Otherwise, check if the current path matches
    return location.pathname === path;
  };

  useEffect(() => {
    dispatch(
      setUserPersonalInformation({
        clientId: personalInfo.clientId,
        menuItemNames: personalInfo.menuItemNames,
      })
    );
  }, [personalInfo.clientId, personalInfo.menuItemNames, dispatch]);

  const headerLogoClickHandler = () => {
    navigate("/dashboard");
  };

  const iconMapping = {
    "Create Folder": FaFolderOpen,
    "User Creation": FaUsersGear,
    "Manage Roles": FaCogs,
    "All Masters": MdStorage,
    "EmailConfiguration": FaMailBulk,
    "Reports": HiOutlineDocumentReport,
    "Storage Settings": PiHardDrivesDuotone,
    "User All Files": LuFolderOpen,
  };


  const handleMenuItemClick = (route, appName) => {
    dispatch(setActiveComponentName(appName));
    navigate(route);
  };

  return (
    <aside className="main-sidebar sidebar-light-blue elevation-1">
      <a
        href="#"
        className="brand-link d-flex flex-row"
        onClick={headerLogoClickHandler}
      >
        <img
          src={bmsLogoWipro}
          alt="Iteos Logo"
          className="img-fluid"
          style={{ height: "40px", width: "100px" }}
        />
      </a>

      <div className="sidebar">
        <nav className="mt-2">
          <ul
            className="nav nav-pills nav-sidebar flex-column"
            data-widget="treeview"
            role="menu"
            data-accordion="false"
          >
            {allRoutesList.length > 0
              ? allRoutesList.map((routesObj, index) => {
                const IconComponent = iconMapping[routesObj.appName] || FaThLarge;
                return (
                  <li
                    key={"route_" + (index + 1)}
                    className={
                      isPathActive(routesObj.appRoute, routesObj.appName)
                        ? "nav-item active"
                        : "nav-item"
                    }
                  >
                    <Link
                      className={
                        isPathActive(routesObj.appRoute, routesObj.appName)
                          ? "nav-link active"
                          : "nav-link"
                      }
                      to={routesObj.appRoute}
                      onClick={() =>
                        handleMenuItemClick(routesObj.appRoute, routesObj.appName)
                      }
                    >
                      <IconComponent className="nav-icon text-sm" />
                      <p className="text-sm">{routesObj.appName}</p>
                    </Link>
                  </li>
                );
              })
              : ""}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Menu;