import React, { Component } from "react";
import "./Departments.css";

export default class Departments extends Component {
  constructor(props) {
    super(props);
    this.state = {
      incidents: [],
      dueDate: "",
      filteredIncidents: [],
      selectedIncident: null,
      departmentName: "",
      filters: {
        statusFilter: "all",
        responseFilter: "all",
        dateFrom: "",
        dateTo: ""
      },
      showDetailsModal: false,
      showUpdateModal: false
    };
  }

async componentDidMount() {
  const token = localStorage.getItem("authToken");

  // Get departmentId from localStorage as fallback, or from URL
  const urlParts = window.location.pathname.split("/");
  const departmentId = localStorage.getItem("departmentId") || urlParts[urlParts.length - 1];

  // Set department name from sessionStorage if exists
  const savedDeptName = sessionStorage.getItem("DepartmentName") || `Department ${departmentId}`;
  this.setState({ departmentName: savedDeptName });

  try {
    // 1️⃣ Fetch incidents for this department
    const res = await fetch(`/departments/${departmentId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    // 2️⃣ Fetch quality responses (feedback + department responses)
    const res2 = await fetch(`/quality`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const qualityData = await res2.json();

    // 3️⃣ Merge data if both responses are valid
    if (data.status === "success" && Array.isArray(data.data) &&
        qualityData.status === "success" && Array.isArray(qualityData.data)) {
      
      const merged = data.data.map((incident) => {
        const qMatch = qualityData.data.find(q => q.IncidentID === incident.IncidentID);
        return { ...incident, ...qMatch };
      });

      this.setState({
        incidents: merged,
        filteredIncidents: merged,
        departmentName: merged[0]?.DepartmentName || savedDeptName
      });
    }
  } catch (err) {
    console.error("Error loading incidents/quality responses:", err);
    // fallback if fetch fails
    this.setState({ departmentName: savedDeptName });
  }
}



  openDetailsModal = (incident) => this.setState({
     showDetailsModal: true,
      selectedIncident: incident 
    });
  closeDetailsModal = () => this.setState({
     showDetailsModal: false, 
     selectedIncident: null
     });
  openUpdateModal = (incident) => this.setState({
     showUpdateModal: true, 
     selectedIncident: incident
     });
  closeUpdateModal = () => this.setState({
     showUpdateModal: false, 
     selectedIncident: null 
    });

  handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const { selectedIncident, dueDate } = this.state;
    if (!selectedIncident) return alert("No incident selected!");

    const probableCauses = e.target["probable-causes"].value;
    const correctiveAction = e.target["corrective-action"].value;
    const urlParts = window.location.pathname.split("/");
    const departmentId = parseInt(urlParts[urlParts.length - 1]);

    const body = {
      IncidentID: selectedIncident.IncidentID,
      DepartmentID: departmentId,
      Reason: probableCauses,
      CorrectiveAction: correctiveAction,
      DueDate: dueDate,
      ...(selectedIncident.ResponseID && { ResponseID: selectedIncident.ResponseID }),
    };

    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/department-response", {
        method: "PUT",
        headers: { "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (res.ok) {
        alert("Update submitted!");
        this.closeUpdateModal();
      } else {
        alert("Update failed: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Network error: " + err.message);
    }
  };

  handleFilterChange = (e) => {
    const { id, value } = e.target;
    this.setState((prev) => ({ filters: { ...prev.filters, [id]: value } }));
  };

  applyFilters = () => {
    const { incidents, filters } = this.state;
    const filtered = incidents.filter((inc) => {
      if (filters.statusFilter !== "all" && inc.status !== filters.statusFilter) 
        return false;
      if (filters.responseFilter !== "all" && inc.responded.toLowerCase() !== filters.responseFilter.toLowerCase()) 
        return false;
      if (filters.dateFrom && new Date(inc.IncidentDate) < new Date(filters.dateFrom)) 
        return false;
      if (filters.dateTo && new Date(inc.IncidentDate) > new Date(filters.dateTo)) return false;
      return true;
    });
    this.setState({ filteredIncidents: filtered });
  };

  clearFilters = () => {
    this.setState({
      filters: { statusFilter: "all", responseFilter: "all", dateFrom: "", dateTo: "" },
      filteredIncidents: this.state.incidents
    });
  };

  render() {
    const { filteredIncidents, filters, showDetailsModal, showUpdateModal, selectedIncident } = this.state;

    return (
      <div className="quality-dashboard">
        <main>
          {/* Filters */}
          <div id="filters">
            <label htmlFor="statusFilter">Status:</label>
            <select id="statusFilter" value={filters.statusFilter} onChange={this.handleFilterChange}>
              <option value="all">All</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="Pending">Pending Response</option>
              <option value="Closed">Closed</option>
            </select>
            <label htmlFor="dateFrom">From Date:</label>
            <input type="date" id="dateFrom" value={filters.dateFrom} onChange={this.handleFilterChange} />
            <label htmlFor="dateTo">To Date:</label>
            <input type="date" id="dateTo" value={filters.dateTo} onChange={this.handleFilterChange} />
            <button onClick={this.applyFilters}>Filter</button>
            <button onClick={this.clearFilters}>Clear</button>
          </div>

          {/* Incidents Table */}
          <table id="incidentTable">
            <thead>
              <tr>
                <th>Incident No</th>
                <th>Date</th>
                <th>Location</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((incident) => (
                <tr key={incident.IncidentID}>
                  <td>{incident.IncidentID}</td>
                  <td>{incident.IncidentDate ? new Date(incident.IncidentDate).toLocaleDateString() : '-'}</td>
                  <td>{incident.Location || '-'}</td>
                  <td>{incident.ReporterName || '-'}</td>
                  <td className={`status-${incident.status.replace(/\s/g, "")}`}>{incident.status || '-'}</td>
                  <td>
                    <button className="btn-details" onClick={() => this.openDetailsModal(incident)}>Details</button>
                    {incident.status === 'Assigned' && (
                      <button className="btn-update" onClick={() => this.openUpdateModal(incident)} style={{ marginLeft: "10px" }}>Update</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Details Modal */}
          {showDetailsModal && selectedIncident && (
            <div className="modal-bg active" onClick={this.closeDetailsModal}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={this.closeDetailsModal}>×</button>

                <h2>Incident Details</h2>
                    <>
                {/* Incident Info */}
                <div className="section">
                  <h3>Incident Information</h3>
                  <div className="grid-2">
                    <p><strong>Incident No:</strong> {selectedIncident.IncidentID || "—"}</p>
                    <p>
                      <strong>Incident Date:</strong>{" "}
                      {selectedIncident.IncidentDate
                        ? new Date(selectedIncident.IncidentDate).toLocaleDateString()
                        : "—"}
                    </p>
                    <p>
                      <strong>Incident Time:</strong>{" "}
                      {selectedIncident.IncidentTime
                        ? new Date(selectedIncident.IncidentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </p>
                    <p><strong>Location:</strong> {selectedIncident.Location || "—"}</p>
                    <p className="span-2">
                      <strong>Affected Individuals:</strong> {selectedIncident.AffectedIndividualsNames || "—"}
                    </p>
                    <p className="span-2">
                      <strong>Incident Description:</strong> {selectedIncident.Description || "—"}
                    </p>
                  </div>
                </div>

                {/* Reporter */}
                <div className="section">
                  <h3>Reporter</h3>
                  <div className="grid-2">
                    <p><strong>Name:</strong> {selectedIncident.ReporterName || "—"}</p>
                    <p><strong>Title:</strong> {selectedIncident.ReporterTitle || "—"}</p>
                  </div>
                </div>

                {/* Actions & Attachments */}
                <div className="section">
                  <h3>Actions & Attachments</h3>
                  <p><strong>Immediate Action Taken:</strong> {selectedIncident.ImmediateAction || "—"}</p>
                  {selectedIncident.Attachments && (
                <p>
                  <strong>Attachments:</strong>{" "}
                  <a
                    href={`/uploads/${selectedIncident.Attachments}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {selectedIncident.Attachments}
                  </a>
                </p>

                  )}
                </div>

                {/* Status & Assignment */}
                <div className="section">
                  <h3>Status & Assignment</h3>
                  <div className="grid-2">
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className={`status-${selectedIncident.status || "__"}`}>
                      {selectedIncident.status || "—"}
                    </span>
                  </p>

                    <p>
                      <strong>Responded by Dept:</strong>{" "}
                      <span className={selectedIncident.responded === "Yes" ? "status-Yes" : "status-No"}>
                        {selectedIncident.responded === "Yes" ? "Yes" : "No"}
                      </span>
                    </p>
                    <p className="span-2">
                      <strong>Assigned Department:</strong> {selectedIncident.DepartmentName || "—"}
                    </p>
                  </div>
                {selectedIncident?.status === "New" && (
                  <div>
                    <h4>Send to the Department</h4>
                    <div className="assign-controls">
                      <select
                        value={this.state.selectedDepartmentId}
                        onChange={(e) => this.setState({ selectedDepartmentId: e.target.value })}
                      >
                        <option value="">Select Department</option>
                        {this.state.departments.map((dept) => (
                          <option key={dept.DepartmentID} value={dept.DepartmentID}>
                            {dept.DepartmentName}
                          </option>
                        ))}
                      </select>
                      <button 
                        onClick={this.handleAssignDepartment} 
                        disabled={!this.state.selectedDepartmentId}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}


                </div>

                {/* Responses */}
                <div className="section">
                  <h3>Response From Department</h3>
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
                      {selectedIncident?.Response?.length > 0 ? (
                        selectedIncident.Response.map((resp, index) => (
                          <tr key={index}>
                            <td>{resp.ResponseDate ? new Date(resp.ResponseDate).toLocaleDateString() : "-"}</td>
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

                {/* Quality Feedback */}
                <div className="section">
                  <h3>Quality Manager Feedback</h3>
                  <div className="grid-2">
                    <p><strong>Categorization:</strong> {selectedIncident.QualityCategorization || "—"}</p>
                    <p><strong>Type:</strong> {selectedIncident.QualityType || "—"}</p>
                    <p><strong>Risk Scoring:</strong> {selectedIncident.QualityRiskScoring || "—"}</p>
                    <p><strong>Effectiveness:</strong> {selectedIncident.QualityEffectiveness || "—"}</p>
                  </div>
                </div>
              </>
              </div>
            </div>
          )}

          {/* Update Modal */}
          {showUpdateModal && selectedIncident && (
            <div className="modal-bg active" onClick={this.closeUpdateModal}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={this.closeUpdateModal}>×</button>
                <h2>Update Incident Response</h2>
                <form onSubmit={this.handleUpdateSubmit}>
                  <div className="section">
                    <label htmlFor="probable-causes">Incident Most Probable Causes:</label>
                    <input type="text" id="probable-causes" placeholder="Enter probable causes" required />
                  </div>
                  <div className="section">
                    <label htmlFor="corrective-action">Corrective / Preventive Action:</label>
                    <textarea id="corrective-action" rows="3" placeholder="Enter corrective action" required />
                  </div>
                  <div className="section">
                    <label htmlFor="due-date">Due Date:</label>
                    <input type="date" id="due-date" value={this.state.dueDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => this.setState({ dueDate: e.target.value })} />
                  </div>
                  <button type="submit" className=".btn-details">Submit Update</button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    );
  }
}
