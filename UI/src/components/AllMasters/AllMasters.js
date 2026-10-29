import React, { useState } from "react";
import Division from "./EachMaster.js/division";
import EmailDomain from "./EachMaster.js/emaildomain";

import AccessType from "./EachMaster.js/AccessType";
import ActionMaster from "./EachMaster.js/ActionMaster";
import DocumentExtention from "./EachMaster.js/DocumentExtension";
import CohortMapping from './EachMaster.js/CohortMapping';

function AllMasters() {
  const [activeTab, setActiveTab] = useState("division");

  const renderContent = () => {
    switch (activeTab) {
      case "division":
        return (
          <div>
            <Division />
          </div>
        );
      case "emailDomain":
        return <div><EmailDomain /></div>;
      case "AccessMaster":
        return <div><AccessType /></div>;
      case "ActionMaster":
        return <div><ActionMaster /></div>;
      case "DocumentExtension":
        return <div><DocumentExtention /></div>;
      case "CohortMapping":
        return <div><CohortMapping /></div>;
      default:
        return null;
    }
  };

  return (
    <>
      <section className="content scroll-content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <div className="card card-primary card-outline">
                <div className="card-header">
                  <h3 className="card-title text-sm">All Masters</h3>
                </div>
                <div className="card-body text-sm">
                  <div className="row">
                    <div className="col-md-12">
                      <button
                        className={`btn tabs-btn btn-sm ${activeTab === "division" ? "btn-primary" : "btn-outline-primary"
                          }`}
                        onClick={() => setActiveTab("division")}
                      >
                        Division
                      </button>
                      <button
                        className={`btn tabs-btn btn-sm ml-2 ${activeTab === "emailDomain" ? "btn-primary" : "btn-outline-primary"
                          }`}
                        onClick={() => setActiveTab("emailDomain")}
                      >
                        Email Domain
                      </button>
                      <button
                        className={`btn tabs-btn btn-sm ml-2 ${activeTab === "AccessMaster" ? "btn-primary" : "btn-outline-primary"
                          }`}
                        onClick={() => setActiveTab("AccessMaster")}
                      >
                        AccessMaster
                      </button>
                      <button
                        className={`btn tabs-btn btn-sm ml-2 ${activeTab === "ActionMaster" ? "btn-primary" : "btn-outline-primary"
                          }`}
                        onClick={() => setActiveTab("ActionMaster")}
                      >
                        ActionMaster
                      </button>
                      <button
                        className={`btn tabs-btn btn-sm ml-2 ${activeTab === "DocumentExtension" ? "btn-primary" : "btn-outline-primary"
                          }`}
                        onClick={() => setActiveTab("DocumentExtension")}
                      >
                        File Extensions
                      </button>
                      <button
                        className={`btn tabs-btn btn-sm ml-2 ${activeTab === "CohortMapping" ? "btn-primary" : "btn-outline-primary"
                          }`}
                        onClick={() => setActiveTab("CohortMapping")}
                      >
                        Cohort Mapping
                      </button>
                    </div>
                  </div>
                  <div className="row mt-3">
                    <div className="col-md-12">{renderContent()}</div>
                  </div>
                </div>
                <div className="card-footer text-sm"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default AllMasters;
