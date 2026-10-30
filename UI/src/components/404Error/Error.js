import React from 'react';
import { useNavigate } from 'react-router-dom';

function Error() {
  const navigate = useNavigate();

  const handleGoToLogin = () => {

    localStorage.removeItem("persist:dda_user");
    localStorage.removeItem("isUserAuthenticated");
    localStorage.removeItem("user_id");
    localStorage.clear();


    navigate("/login");
  };

  return (
    <section className="d-flex justify-content-center align-items-center vh-100 text-center">
      <div>
        <div className="error-code">404</div>
        <h1 className="fw-bold">PAGE NOT FOUND</h1>
        <p className="text-muted">
          The page you are looking for might have been removed<br />
          had its name changed or is temporarily unavailable.
        </p>
        <button
          className="btn-homepage"
          onClick={handleGoToLogin}
        >
          GO TO LOGIN PAGE
        </button>
      </div>
    </section>
  );
}

export default Error;
