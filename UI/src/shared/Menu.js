import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  setActiveComponentName,
  setUserPersonalInformation,
} from "../reduxStorage/personalInformation";
import { FaUsersGear } from "react-icons/fa6";
import { FaThLarge, FaCogs, FaHome } from "react-icons/fa";
import { FaFolderOpen } from "react-icons/fa6";
import { FaMailBulk } from "react-icons/fa";
import { MdStorage } from "react-icons/md";
import { HiOutlineDocumentReport } from "react-icons/hi";
import { PiHardDrivesDuotone } from "react-icons/pi";
import { LuFolderOpen } from "react-icons/lu";

const iconMapping = {
  "Create Folder": FaFolderOpen,
  "User Creation": FaUsersGear,
  "Manage Roles": FaCogs,
  "All Masters": MdStorage,
  "EmailConfiguration": FaMailBulk,
  "Reports": HiOutlineDocumentReport,
  "My Reviews": PiHardDrivesDuotone,
  "Folder Access Report": HiOutlineDocumentReport,
  "Storage Settings": PiHardDrivesDuotone,
  "User All Files": LuFolderOpen,
};

const closeSidebarOnSmallScreens = () => {
  if (window.innerWidth >= 992) return;
  try {
    if (window.$ && window.$.fn && window.$.fn.PushMenu) {
      window.$('[data-widget="pushmenu"]').PushMenu("collapse");
      return;
    }
  } catch (e) {
    /* fall through */
  }
  document.body.classList.remove("sidebar-open");
};

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
    if (appName === "Create Folder" && userFilesUserID && userName) return false;
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

  const handleMenuItemClick = (appName) => {
    dispatch(setActiveComponentName(appName));
    closeSidebarOnSmallScreens();
  };

  const goHome = () => {
    navigate("/home");
    closeSidebarOnSmallScreens();
  };

  const homeActive = location.pathname === "/home";

  return (
    <aside className="main-sidebar sidebar-light-blue sp-sidenav elevation-1">
      <button type="button" className="sp-site" onClick={goHome} aria-label="Go to home">
        <span className="sp-site-tile">D</span>
        <span className="sp-site-text">
          <strong>Document Digitization</strong>
          <small>{personalInfo.userRole}</small>
        </span>
      </button>

      <div className="sidebar">
        <nav className="mt-2" aria-label="Main navigation">
          <ul
            className="nav nav-pills nav-sidebar flex-column"
            data-widget="treeview"
            role="menu"
            data-accordion="false"
          >
            <li className={homeActive ? "nav-item active" : "nav-item"}>
              <Link
                className={homeActive ? "nav-link active" : "nav-link"}
                to="/home"
                aria-current={homeActive ? "page" : undefined}
                onClick={() => handleMenuItemClick("Home")}
              >
                <FaHome className="nav-icon" />
                <p>Home</p>
              </Link>
            </li>
            {allRoutesList.length > 0
              ? allRoutesList.map((routesObj, index) => {
                const IconComponent = iconMapping[routesObj.appName] || FaThLarge;
                const active = isPathActive(routesObj.appRoute, routesObj.appName);
                return (
                  <li key={"route_" + (index + 1)} className={active ? "nav-item active" : "nav-item"}>
                    <Link
                      className={active ? "nav-link active" : "nav-link"}
                      to={routesObj.appRoute}
                      aria-current={active ? "page" : undefined}
                      onClick={() => handleMenuItemClick(routesObj.appName)}
                    >
                      <IconComponent className="nav-icon" />
                      <p>{routesObj.appName}</p>
                    </Link>
                  </li>
                );
              })
              : null}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Menu;