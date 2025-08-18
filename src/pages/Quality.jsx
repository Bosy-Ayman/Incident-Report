import React, { Component } from "react";
import "./Quality.css";

export default class Quality extends Component {
  constructor(props) {
    super(props);
    this.state = {
      incidents: [],
      departments: [],
       incidentResponses: [],
      showDetailsModal: false,
      showUpdateModal: false,
      selectedIncident: null,
      selectedDepartmentId: "",
      categorization: "",
      type: [],
      riskScoring: "",
      effectiveness: "",
      comment: ""
    };

  }

  componentDidMount() {
    fetch("/quality")
      .then(res => res.json())
      .then(data => {
        const incidentsArray = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        this.setState({ incidents: incidentsArray });
      })
      .catch(err => console.error(err));

    fetch("/departments")
      .then(res => res.json())
      .then(data => this.setState({ departments: Array.isArray(data) ? data : [] }))
      .catch(err => console.error(err));

    fetch("/quality/responses")
      .then(res => res.json())
      .then(data => {
        console.log("Responses:", data); 
        this.setState({ 
          incidentResponses: Array.isArray(data.data) ? data.data : []  
        });
      })
      .catch(err => console.error(err));

    }



  openUpdateModal = (incident) => {
    const responses = this.state.incidentResponses.filter(
      r => r.IncidentID == incident.IncidentID
    );

    this.setState({
      showUpdateModal: true,
      selectedIncident: { ...incident, Response: responses }
    });
  };



  closeDetailsModal = () => {
    this.setState({ showDetailsModal: false, selectedIncident: null });
  };


  openDetailsModal = (incident) => {
    this.setState({
      showDetailsModal: true,
      selectedIncident: incident
    });
  };
  openUpdateModal = (incident) => {
    const responses = this.state.incidentResponses.filter(
      r => r.IncidentID == incident.IncidentID
    );

  console.log("Filtered responses:", responses); 

  this.setState({
    showUpdateModal: true,
    selectedIncident: { ...incident, Response: responses }
  });
};


  closeUpdateModal = () => {
    this.setState({ showUpdateModal: false, selectedIncident: null });
  };

  handleUpdateSubmit = (e) => {
    e.preventDefault();
    const {
      selectedIncident,
      categorization,
      type,
      riskScoring,
      effectiveness,
      incidentResponses,
      comment
    } = this.state;

    fetch(`/quality`, {
      method: "PUT", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentId: selectedIncident.IncidentID,
        categorization,
        type,
        riskScoring,
        effectiveness,
        comment
      })
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message || "Incident updated successfully!");
        this.closeUpdateModal();
      })
      .catch(err => {
        console.error("Error updating incident:", err);
        alert("Failed to update incident.");
      });
  };

  handleAssignDepartment = () => {
    const { selectedIncident, selectedDepartmentId } = this.state;
    fetch("/responses")
      .then(res => res.json())
      .then(data => {
        console.log("Responses fetched:", data); 
        this.setState({ incidentResponses: Array.isArray(data) ? data : [] });
      })
    .catch(err => console.error(err));

    fetch("/quality", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        incidentId: selectedIncident.IncidentID,
        departmentId: selectedDepartmentId
      })
    })
      .then(res => res.json())
      .then(() => {
        // Refresh incidents after update
        this.componentDidMount();
        this.setState({ showDetailsModal: false, selectedDepartmentId: "" });
      })
      .catch(err => console.error("Error assigning department:", err));
  };


  render() {
    const {
      incidents,
      departments,
      showDetailsModal,
      showUpdateModal,
      selectedIncident,
        incidentResponses,

      selectedDepartmentId
    } = this.state;

    return (
      <div className="quality-dashboard">
        <header>
          <img src="alnas-hospital.png" alt="Hospital Logo" />
          <h1>Quality Department Dashboard</h1>
        </header>

        <main>
          {/* Filters */}
          <div id="filters">
            <label htmlFor="statusFilter">Status:</label>
            <select id="statusFilter">
              <option value="all">All</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="PendingResponse">Pending Response</option>
              <option value="Closed">Closed</option>
            </select>

            <label htmlFor="responseFilter">Responded by Dept:</label>
            <select id="responseFilter">
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>

            <label htmlFor="dateFrom">From Date:</label>
            <input type="date" id="dateFrom" />

            <label htmlFor="dateTo">To Date:</label>
            <input type="date" id="dateTo" />

            <button>Filter</button>
            <button>Clear</button>
          </div>

          {/* Incident Table */}
          <table id="incidentTable">
            <thead>
              <tr>
                <th>Incident No</th>
                <th>Date</th>
                <th>Location</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Responded by Dept</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>
                    No incidents found.
                  </td>
                </tr>
              ) : (
                incidents.map((incident) => (
                  <tr
                    key={incident.IncidentID}
                    data-status={incident.status}
                    data-responded={incident.responded}
                    data-date={incident.Date}
                  >
                    <td>{incident.IncidentID}</td>
                    <td>{incident.Date}</td>
                    <td>{incident.Location}</td>
                    <td>{incident.ReporterName}</td>
                    <td className={`status-${incident.status}`}>{incident.status}</td>
                    <td>{incident.responded}</td>
                    <td>
                      <button
                        className="details-btn"
                        onClick={() => this.openDetailsModal(incident)}
                      >
                        Details
                      </button>
                      <button
                        className="update-btn"
                        onClick={() => this.openUpdateModal(incident)}
                        style={{ marginLeft: "10px" }}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Details Modal */}
          <div
            className={`modal-bg ${showDetailsModal ? "active" : ""}`}
            onClick={this.closeDetailsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-title"
          >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <button
                className="close-btn"
                onClick={this.closeDetailsModal}
                aria-label="Close details modal"
              >
                ×
              </button>

              <h2 id="details-title">Incident Details</h2>
              {selectedIncident && (
                <>
                  <p><strong>Incident No:</strong> {selectedIncident.IncidentID}</p>
                  <p><strong>Date:</strong> {selectedIncident.Date}</p>
                  <p><strong>Location:</strong> {selectedIncident.Location}</p>
                  <p><strong>Reporter:</strong> {selectedIncident.ReporterName}</p>
                  <p><strong>Status:</strong> {selectedIncident.status}</p>
                  <p><strong>Responded:</strong> {selectedIncident.responded ? "Yes" : "No"}</p>
                  <p><strong>Assigned Department:</strong> {}</p>

                </>
              )}

              <h2>Send to the Department</h2>
              <div id="filters">
              <select
              value={this.state.selectedDepartmentId}
              onChange={(e) => this.setState({ selectedDepartmentId: e.target.value })}
            >
              <option value="">Select Department</option>
              {this.state.departments.map(dept => (
                <option key={dept.DepartmentID} value={dept.DepartmentID}>
                  {dept.DepartmentName}
                </option>
              ))}
            </select>

                <button onClick={this.handleAssignDepartment}>Submit</button>
              </div>
            </div>
          </div>

          {/* Update Modal */}

          <div
            className={`modal-bg ${showUpdateModal ? "active" : ""}`}
            onClick={this.closeUpdateModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-title"
          >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <button
                className="close-btn"
                onClick={this.closeUpdateModal}
                aria-label="Close update modal"
              >
                ×
              </button>

              <form onSubmit={this.handleUpdateSubmit}>
              <div className="section">
              <h2>Incident Response</h2>
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Due Date</th>
                    <th>Incident Most Probable Causes</th>
                    <th>Corrective / Preventive Action</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedIncident && selectedIncident.Response && selectedIncident.Response.length > 0 ? (
                  selectedIncident.Response.map((resp, index) => (
                    <tr key={index}>
                      <td>{resp.ResponseDate || "—"}</td>
                      <td>{resp.Reason || "—"}</td>
                      <td>{resp.CorrectiveAction || "—"}</td>
                      <td>{resp.DepartmentName || "—"}</td>  {/* Extra column */}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center" }}>No response data</td>
                  </tr>
                )}
            </tbody>

              </table>
            </div>
                <div className="section">
                  <table className="modal-table">
                    <thead>
                      <tr>
                        <th>Follow-Up Date</th>
                        <th>Status</th>
                        <th>Effectiveness Result</th>
                        <th>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* <tr>
                        <td>2025-08-17</td>
                        <td><span className="status-pending">pending</span></td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>Awaiting verification</td>
                      </tr> */}
                    </tbody>
                  </table>

                <h3>Categorization</h3><br/>
               <textarea
                    value={this.state.categorization}
                    onChange={(e) => this.setState({ categorization: e.target.value })}
                    rows="2"
                    placeholder=""
                  />

                  <h3>Type </h3>
                  <div className="checkbox-group">
                    <label>
                      <input type="checkbox" name="type" value="Near Miss Events" />
                      <strong>Near Miss Events:</strong> any process variation that did not affect an outcome but for which a recurrence carries a significant chance of a serious adverse outcome
                    </label><br/><br/>
                    <label>
                      <input type="checkbox" name="type" value="Adverse Events" />
                      <strong>Adverse Events:</strong> An event that results in injury or ill-health after reaching the patient
                    </label><br/><br/>
                    <label>
                      <input type="checkbox" name="type" value="Significant Events" />
                      <strong>Significant Events:</strong> Significant unexpected events can happen even in hospitals
                    </label><br/><br/>
                    <label>
                      <input type="checkbox" name="type" value="Sentinel Events" />
                      <strong>Sentinel Events</strong>: is a Patient Safety Event that reaches a patient and needs an immediate investigation and response
                    </label>
                  </div>

                  
                  <h3>Risk Scoring</h3>
                  <div id = 'filters'>
                    <select>
                       <option value="RiskScoring">1</option>
                       <option value="RiskScoring">2</option>
                       <option value="RiskScoring">3</option>
                        <option value="RiskScoring">4</option>
                     <option value="RiskScoring">5</option>
                    </select> 
                  </div>

                  <h3>Corrective/Preventive Action Effectiveness Review after Implementation:</h3>
                  <div id = 'filters'>
                    <select>
                      <option value="Effectivness"> Effective (OVR Closed) </option>
                      <option value="Effectiness">Ineffective (Needs another corrective/preventive action) </option>

                    </select> 
                  </div>
                </div>

                <button type="submit" 
                    className="btn-quality"
                    onClick={() => alert("Reply sent!")}>
                  Submit Update
                </button>
              </form>
            </div>
          </div>
          <div
            className={`modal-bg ${showUpdateModal ? "active" : ""}`}
            onClick={this.closeUpdateModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-title"
          >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <button
                className="close-btn"
                onClick={this.closeUpdateModal}
                aria-label="Close update modal"
              >
                ×
              </button>

              <form onSubmit={this.handleUpdateSubmit}>
              <div className="section">
              <h2>Incident Response</h2>
              <table className="modal-table">
                <thead>
                  <tr>
                    <th>Due Date</th>
                    <th>Incident Most Probable Causes</th>
                    <th>Corrective / Preventive Action</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedIncident && selectedIncident.Response && selectedIncident.Response.length > 0 ? (
                  selectedIncident.Response.map((resp, index) => (
                    <tr key={index}>
                      <td>{resp.ResponseDate || "—"}</td>
                      <td>{resp.Reason || "—"}</td>
                      <td>{resp.CorrectiveAction || "—"}</td>
                      <td>{resp.DepartmentName || "—"}</td>  
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center" }}>No response data</td>
                  </tr>
                )}
            </tbody>

              </table>
            </div>

              <h2 id="quality-title">Sending Follow-Up</h2>

              <div className="section">

              <h3>Categorization</h3><br/>
               <textarea
                    value={this.state.categorization}
                    onChange={(e) => this.setState({ categorization: e.target.value })}
                    rows="2"
                    placeholder=""
                  />

                  <h3>Type </h3>
                  <div className="checkbox-group">
                    <label>
                      <input type="checkbox" name="type" value="Near Miss Events" />
                      <strong>Near Miss Events:</strong> any process variation that did not affect an outcome but for which a recurrence carries a significant chance of a serious adverse outcome
                    </label><br/><br/>
                    <label>
                      <input type="checkbox" name="type" value="Adverse Events" />
                      <strong>Adverse Events:</strong> An event that results in injury or ill-health after reaching the patient
                    </label><br/><br/>
                    <label>
                      <input type="checkbox" name="type" value="Significant Events" />
                      <strong>Significant Events:</strong> Significant unexpected events can happen even in hospitals
                    </label><br/><br/>
                    <label>
                      <input type="checkbox" name="type" value="Sentinel Events" />
                      <strong>Sentinel Events</strong>: is a Patient Safety Event that reaches a patient and needs an immediate investigation and response
                    </label>
                  </div>

                  
                  <h3>Risk Scoring</h3>
                  <div id = 'filters'>
                    <select>
                       <option value="RiskScoring">1</option>
                       <option value="RiskScoring">2</option>
                       <option value="RiskScoring">3</option>
                        <option value="RiskScoring">4</option>
                     <option value="RiskScoring">5</option>
                    </select> 
                  </div>

                  <h3>Corrective/Preventive Action Effectiveness Review after Implementation:</h3>
                  <div id = 'filters'>
                    <select>
                      <option value="Effectivness"> Effective (OVR Closed) </option>
                      <option value="Effectiness">Ineffective (Needs another corrective/preventive action) </option>

                    </select> 
                  </div>
                </div>

                <button type="submit" 
                    className="btn-quality"
                    onClick={() => alert("Reply sent!")}>
                  Submit Update
                </button>
              </form>
            </div>
            
          </div>

        </main>
      </div>
    );
  }
}
