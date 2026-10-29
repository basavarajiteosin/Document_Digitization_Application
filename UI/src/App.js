import React, { useState, useEffect } from 'react';
import AppRoutes from './AppRoutes';
import { useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { Provider } from 'react-redux';
import reduxStore from './reduxStorage/combinedReducers';
import 'react-toastify/dist/ReactToastify.css';
import Header from './shared/Header';
import Menu from './shared/Menu';
import Footer from './shared/Footer';
import { LoaderProvider } from './Customhook/LoaderContext';
import { UserProvider } from './components/UserContext/UserContext';
import { UploadProvider } from './Customhook/UploadContext';
import UploadStatusPanel from './components/UploadStatus/UploadStatusPanel';
import { useAppVersionCheck } from "./hooks/useAppVersionCheck";



const App = () => {
  const [isFullPageLayout, setIsFullPageLayout] = useState(false);

  const location = useLocation()

  useAppVersionCheck({ intervalMs: 10 * 60 * 1000 });

  const fullPageLayoutRoutes = [
    '/login',
    '/reset-password',
    "/404",
    "/externalAccess"
  ];

  useEffect(() => {
    onRouteChanged();
  });

  const onRouteChanged = () => {
    window.scrollTo(0, 0);
    let flag = false;
    fullPageLayoutRoutes.map((path) => {
      if (location.pathname === path || location.pathname === '/404') {
        flag = true
      }
    })
    setIsFullPageLayout(flag)
  }

  return (
    <Provider store={reduxStore}>
      <LoaderProvider>
        <UserProvider>
          <UploadProvider>
            {!isFullPageLayout ?
              <div className="wrapper">

                <Header />
                <Menu />
                <div className="content-wrapper">
                  <AppRoutes />
                </div>
                <Footer />
                <ToastContainer
                  position="top-center"
                  autoClose={1500}
                  hideProgressBar={true}
                  newestOnTop={false}
                  closeOnClick={true}
                  rtl={false}
                  draggable
                  pauseOnHover={false}
                  theme="light"
                  limit={1}
                />
              </div>
              : <><AppRoutes /><ToastContainer position="top-center"
                autoClose={1500}
                hideProgressBar={true}
                newestOnTop={false}
                closeOnClick={true}
                rtl={false}
                draggable
                pauseOnHover={false}
                theme="light"
                limit={1}
              /></>
            }
            {/* Rendered once, outside the routed pages, so background uploads and their
          progress panel keep running and stay visible across every tab/menu/route. */}
            {!isFullPageLayout && <UploadStatusPanel />}
          </UploadProvider>
        </UserProvider>
      </LoaderProvider>
    </Provider>
  );
}

export default App;