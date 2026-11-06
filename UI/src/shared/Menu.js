import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { setActiveComponentName } from "../reduxStorage/personalInformation";
import {
  FiHome, FiGrid, FiUsers, FiShield, FiMail, FiDatabase, FiHardDrive, FiFileText,
  FiFolder, FiMessageSquare, FiChevronDown, FiSettings, FiLayers, FiPenTool, FiBarChart2,
} from "react-icons/fi";
import bmswhiteLogoWipro from "../assets/images/wiprologowhite.png";
const MOBILE_BP = 992;

const ICONS = {
  "/home": FiHome,
  "/dashboard": FiFolder,
  "/my-reviews": FiMessageSquare,
  "/all-files": FiFileText,
  "/reports": FiBarChart2,
  "/folder-access-report": FiShield,
  "/create-user": FiUsers,
  "/manage-roles": FiShield,
  "/email-config": FiMail,
  "/all-masters": FiDatabase,
  "/storage-settings": FiHardDrive,
};

const HOME_ITEM = { appName: "Home", appRoute: "/home" };

const GROUPS = [
  { key: "overview", title: "Overview", routes: ["/home", "/dashboard"] },
  { key: "work", title: "Work", routes: ["/my-reviews", "/all-files"] },
  { key: "insights", title: "Insights", routes: ["/reports", "/folder-access-report"] },
  { key: "config", title: "App Configuration", collapsible: true, icon: FiSettings, routes: ["/create-user", "/manage-roles", "/email-config"] },
  { key: "masters", title: "Masters", collapsible: true, icon: FiLayers, routes: ["/all-masters", "/storage-settings"] },
];

const isMobile = () => window.innerWidth < MOBILE_BP;

const closeSidebar = () => {
  if (!isMobile()) return;
  try {
    if (window.$ && window.$.fn && window.$.fn.PushMenu) {
      window.$('[data-widget="pushmenu"]').PushMenu("collapse");
    }
  } catch (e) { /* fall through */ }
  document.body.classList.remove("sidebar-open");
};

const Menu = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const personalInfo = useSelector((s) => s.personalInformationReducer);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState({});
  const [hasInitialized, setHasInitialized] = useState(false);

  // dynamic menu from Redux
  useEffect(() => {
    setItems(personalInfo.menuItemNames || []);
  }, [personalInfo.menuItemNames]);

  // auto-collapse on mount + whenever the viewport shrinks below 992px
  useEffect(() => {
    let wasMobile = isMobile();

    // Force sidebar collapse directly on body at the root render level
    document.body.classList.remove("sidebar-open");
    document.body.classList.add("sidebar-collapse");

    const onResize = () => {
      const nowMobile = isMobile();
      if (nowMobile && !wasMobile) closeSidebar();
      wasMobile = nowMobile;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // collapse after every navigation on small screens
  useEffect(() => { closeSidebar(); }, [location.pathname]);

  // isActive: also highlights nested routes (e.g. /reports/xyz)
  const isActive = useCallback((path, appName) => {
    const sp = new URLSearchParams(location.search);
    if (appName === "My Workspace" && sp.get("userFilesUserID") && sp.get("userName")) return false;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  }, [location.pathname, location.search]);

  const all = [HOME_ITEM, ...items.filter((m) => m.appRoute !== "/home")];
  const byRoute = Object.fromEntries(all.map((m) => [m.appRoute, m]));
  const placed = new Set(GROUPS.flatMap((g) => g.routes));
  const leftovers = all.filter((m) => !placed.has(m.appRoute));

  const sections = [
    ...GROUPS.map((g) => ({ ...g, list: g.routes.map((r) => byRoute[r]).filter(Boolean) })),
    { key: "more", title: "More", list: leftovers },
  ].filter((g) => g.list.length > 0);

  // auto-expand the submenu that contains the current page
  useEffect(() => {

    if (!hasInitialized) {
      setHasInitialized(true);
      return; // Keeps submenus collapsed on page load
    }

    sections.forEach((g) => {
      if (g.collapsible && g.list.some((m) => isActive(m.appRoute, m.appName))) {
        setOpen((p) => (p[g.key] ? p : { ...p, [g.key]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, items]);

  const onNav = (appName) => {
    dispatch(setActiveComponentName(appName));
    closeSidebar();
  };

  const renderLink = (m) => {
    const Icon = ICONS[m.appRoute] || FiGrid;
    const active = isActive(m.appRoute, m.appName);
    return (
      <Link
        key={m.appRoute}
        to={m.appRoute}
        title={m.appName}
        className={`sf-link ${active ? "active" : ""}`}
        aria-current={active ? "page" : undefined}
        onClick={() => onNav(m.appName)}
      >
        <Icon className="sf-ico" />
        <span className="sf-txt">{m.appName}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className="main-sidebar sf-side elevation-0" aria-label="Main navigation">
        <button type="button" className="sf-brand" title="Home" onClick={() => { navigate("/home"); closeSidebar(); }}>
          <img className="sf-brand-logo" src={bmswhiteLogoWipro} alt="Wipro" />
          <span className="sf-brand-txt">
            <span className="sf-brand-name">Document Digitization</span>
            <span className="sf-brand-sub">{personalInfo.userRole || "Workspace"}</span>
          </span>
        </button>

        <div className="sf-scroll">
          <nav>
            {sections.map((g) => {
              if (!g.collapsible) {
                return (
                  <div key={g.key}>
                    <div className="sf-hint"><span>{g.title}</span></div>
                    {g.list.map(renderLink)}
                  </div>
                );
              }
              const GIcon = g.icon;
              const isOpen = !!open[g.key];
              const hasActive = g.list.some((m) => isActive(m.appRoute, m.appName));
              return (
                <div key={g.key} className="sf-group">
                  <button
                    type="button"
                    title={g.title}
                    className={`sf-link sf-group-btn ${hasActive ? "has-active" : ""}`}
                    aria-expanded={isOpen}
                    onClick={() => setOpen((p) => ({ ...p, [g.key]: !p[g.key] }))}
                  >
                    <GIcon className="sf-ico" />
                    <span className="sf-txt">{g.title}</span>
                    <FiChevronDown className={`sf-chev ${isOpen ? "open" : ""}`} />
                  </button>
                  <div className={`sf-collapse ${isOpen ? "open" : ""}`}>
                    <div className="sf-children">{g.list.map(renderLink)}</div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="sf-backdrop" onClick={closeSidebar} aria-hidden="true" />
    </>
  );
};

export default Menu;