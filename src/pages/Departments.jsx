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
      departments: [],
      isLoading: false,
      selectedDepartmentId: "",
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
    this.setState({ isLoading: true });
    const token = localStorage.getItem("authToken");
    const urlParts = window.location.pathname.split("/");
    const departmentId = localStorage.getItem("departmentId") || urlParts[urlParts.length - 1];
    const savedDeptName = sessionStorage.getItem("DepartmentName") || `Department ${departmentId}`;
    this.setState({ departmentName: savedDeptName });

    try {
      const [deptRes, assignedRes, qualityRes, allDepartmentsRes] = await Promise.all([
        fetch(`/departments/${departmentId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/assigned-departments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/quality`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/departments', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const deptData = await deptRes.json();
      const assignedData = await assignedRes.json();
      const qualityData = await qualityRes.json();
      const allDepartmentsData = await allDepartmentsRes.json();

      if (!deptRes.ok) throw new Error(`Server error: ${deptRes.status}`);

      const allDepartmentsMap = (allDepartmentsData?.data || []).reduce((map, dept) => {
        map[dept.DepartmentID] = dept.DepartmentName;
        return map;
      }, {});

      const transformedIncidents = deptData.data.map(incident => {
        const qMatch = qualityData?.data?.find(q => q.IncidentID === incident.IncidentID) || {};
        const assigned = (assignedData?.data || []).find(ad => String(ad.IncidentID) === String(incident.IncidentID)) || {};

        let assignedNames = assigned.DepartmentNames || "—";
        let assignedIDs = assigned.DepartmentIDs ? assigned.DepartmentIDs.split(",").map(id => id.trim()) : [];

        if (!assignedNames || assignedNames === "—" && assigned.DepartmentIDs) {
          const ids = assigned.DepartmentIDs.split(",").map(id => id.trim());
          assignedNames = ids.map(id => allDepartmentsMap[id] || `Unknown (${id})`).join(", ");
          assignedIDs = ids;
        }

        let responses = [];
        try {
          responses = incident.Responses ? JSON.parse(incident.Responses) : [];
        } catch (err) {
          console.error(`Error parsing Responses for IncidentID ${incident.IncidentID}:`, err);
        }

        return {
          ...incident,
          FeedbackType: incident.FeedbackType || "—",
          FeedbackCategorization: incident.FeedbackCategorization || "—",
          FeedbackRiskScoring: incident.FeedbackRiskScoring || "—",
          FeedbackEffectiveness: incident.FeedbackEffectiveness || "—",
          FeedbackDate: incident.ResponseDate || "—",
          QualitySpecialistName: qMatch.QualitySpecialistName || "—",
          ReviewedFlag: incident.ReviewedFlag === true || incident.ReviewedFlag === 1 ? "Yes" :
                        incident.ReviewedFlag === false || incident.ReviewedFlag === 0 ? "No" : "—",
          AffectedIndividualsNames: qMatch.AffectedIndividualsNames || "—",
          ImmediateAction: qMatch.ImmediateAction || "—",
          IncidentDescription: qMatch.IncidentDescription || "—",
          assignedDepartmentNames: assignedNames,
          assignedDepartmentIDs: assignedIDs,
          Response: responses,
          ResponseID: responses.find(r => r.DepartmentID === parseInt(departmentId))?.ResponseID || null,
          RespondedFlag: incident.RespondedFlag || "false"
        };
      });

      this.setState({
        incidents: transformedIncidents,
        filteredIncidents: transformedIncidents,
        departmentName: transformedIncidents[0]?.DepartmentName || savedDeptName,
        departments: allDepartmentsData?.data || [],
        isLoading: false
      });
    } catch (err) {
      console.error("Error loading incidents:", err);
      this.setState({ departmentName: savedDeptName, isLoading: false });
      alert("Failed to load incidents: " + err.message);
    }
  }

  openDetailsModal = (incident) => this.setState({
    showDetailsModal: true,
    selectedIncident: incident
  });

  closeDetailsModal = () => this.setState({
    showDetailsModal: false,
    selectedIncident: null,
    selectedDepartmentId: ""
  });

  openUpdateModal = (incident) => this.setState({
    showUpdateModal: true,
    selectedIncident: incident,
    dueDate: incident.Response?.find(r => r.DepartmentID === parseInt(window.location.pathname.split("/").pop()))?.DueDate || ""
  });

  closeUpdateModal = () => this.setState({
    showUpdateModal: false,
    selectedIncident: null,
    dueDate: ""
  });

  handleAssignDepartment = async () => {
    const { selectedIncident, selectedDepartmentId, departments } = this.state;
    if (!selectedIncident || !selectedDepartmentId) return alert("No department selected!");

    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/assign-department", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          IncidentID: selectedIncident.IncidentID,
          DepartmentID: selectedDepartmentId,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        alert("Department assigned successfully!");
        this.setState((prevState) => {
          const updatedIncidents = prevState.incidents.map((inc) => {
            if (inc.IncidentID === selectedIncident.IncidentID) {
              const deptName = departments.find(
                (dept) => dept.DepartmentID === parseInt(selectedDepartmentId)
              )?.DepartmentName || "Unknown";
              return {
                ...inc,
                assignedDepartmentNames: inc.assignedDepartmentNames
                  ? `${inc.assignedDepartmentNames}, ${deptName}`
                  : deptName,
                assignedDepartmentIDs: inc.assignedDepartmentIDs
                  ? [...inc.assignedDepartmentIDs, selectedDepartmentId]
                  : [selectedDepartmentId],
                status: "Assigned",
              };
            }
            return inc;
          });
          return {
            incidents: updatedIncidents,
            filteredIncidents: updatedIncidents,
            showDetailsModal: false,
            selectedIncident: null,
            selectedDepartmentId: "",
          };
        });
      } else {
        alert("Assignment failed: " + (result.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Network error: " + err.message);
    }
  };

  handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const { selectedIncident, dueDate, departmentName } = this.state;
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (res.ok) {
        alert("Update submitted!");
        this.setState((prevState) => {
          const updatedIncidents = prevState.incidents.map((inc) => {
            if (inc.IncidentID === selectedIncident.IncidentID) {
              const newResponse = result.response;
              const updatedResponses = inc.Response ? inc.Response.filter(r => r.DepartmentID !== departmentId) : [];
              updatedResponses.push(newResponse);
              return {
                ...inc,
                Response: updatedResponses,
                status: "Pending",
                responded: "Yes",
                RespondedFlag: "true",
                ResponseID: newResponse.ResponseID
              };
            }
            return inc;
          });
          return {
            incidents: updatedIncidents,
            filteredIncidents: updatedIncidents,
            showUpdateModal: false,
            selectedIncident: null,
            dueDate: "",
          };
        });
      } else {
        alert("Update failed: " + (result.message || "Unknown error"));
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
      if (filters.dateTo && new Date(inc.IncidentDate) > new Date(filters.dateTo)) 
        return false;
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
    const { filteredIncidents, filters, showDetailsModal, showUpdateModal, selectedIncident, isLoading } = this.state;

    return (
      <div className="quality-dashboard">
        <main>
          {isLoading ? (
      <div 
        className="protected-container" 
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <div className="loader"></div>
      </div>
      ) : (
            <>
              <div id="filters">
                <label htmlFor="statusFilter">Status:</label>
                <select id="statusFilter" value={filters.statusFilter} onChange={this.handleFilterChange}>
                  <option value="all">All</option>
                  <option value="New">New</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Pending">Pending Response</option>
                  <option value="Closed">Closed</option>
                </select>
                <label htmlFor="responseFilter">Response Status:</label>
                <select id="responseFilter" value={filters.responseFilter} onChange={this.handleFilterChange}>
                  <option value="all">All</option>
                  <option value="Yes">Responded</option>
                  <option value="No">Not Responded</option>
                </select>
                <label htmlFor="dateFrom">From Date:</label>
                <input type="date" id="dateFrom" value={filters.dateFrom} onChange={this.handleFilterChange} />
                <label htmlFor="dateTo">To Date:</label>
                <input type="date" id="dateTo" value={filters.dateTo} onChange={this.handleFilterChange} />
                <button onClick={this.applyFilters}>Filter</button>
                <button onClick={this.clearFilters}>Clear</button>
              </div>

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
                        {(incident.status === 'Assigned' || incident.status === 'Pending') && (
                          <button 
                          className="btn-update" 
                          onClick={() => this.openUpdateModal(incident)} 
                          style={{ marginLeft: "10px" }}>Update</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {showDetailsModal && selectedIncident && (
                <div className="modal-bg active" onClick={this.closeDetailsModal}>
                  <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                    <button className="close-btn" onClick={this.closeDetailsModal}>×</button>
                    <h2>Incident Details</h2>
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
                          <strong>Incident Description:</strong> {selectedIncident.IncidentDescription || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="section">
                      <h3>Reporter</h3>
                      <div className="grid-2">
                        <p><strong>Name:</strong> {selectedIncident.ReporterName || "—"}</p>
                        <p><strong>Title:</strong> {selectedIncident.ReporterTitle || "—"}</p>
                      </div>
                    </div>

                    <div className="section">
                      <h3>Actions & Attachments</h3>
                      <p><strong>Immediate Action Taken:</strong> {selectedIncident.ImmediateAction || "—"}</p>
                    {selectedIncident.Attachment && (
                      <div>
                        <strong>Attachments:</strong>
                        <ul>
                          {selectedIncident.Attachment.split(",").map((file, idx) => (
                            <li key={idx}>
                            <a 
                              href={`/uploads/${file.trim()}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              {file.trim()}
                            </a>


                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    </div>

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
                        <p>
                          <strong>Responded Flag:</strong>{" "}
                          <span className={selectedIncident.RespondedFlag === "true" ? "status-Yes" : "status-No"}>
                            {selectedIncident.RespondedFlag === "true" ? "Yes" : "No"}
                          </span>
                        </p>
                        <p className="span-2">
                          <strong>Assigned Department(s):</strong>{" "}
                          {selectedIncident.assignedDepartmentNames && selectedIncident.assignedDepartmentNames.trim() !== "" ? (
                            <ul>
                              {selectedIncident.assignedDepartmentNames.split(", ").map((name, index) => (
                                <li key={index}>{name}</li>
                              ))}
                            </ul>
                          ) : (
                            "—"
                          )}
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
                                <td>{resp.DueDate ? new Date(resp.DueDate).toLocaleDateString() : "—"}</td>
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

                    <div className="section">
                      <h3>Quality Manager Feedback</h3>
                      <div className="grid-2">
                        <p><strong>Categorization:</strong> {selectedIncident.FeedbackCategorization || "—"}</p>
                        <p><strong>Type:</strong> {selectedIncident.FeedbackType || "—"}</p>
                        <p><strong>Risk Scoring:</strong> {selectedIncident.FeedbackRiskScoring || "—"}</p>
                        <p><strong>Effectiveness:</strong> {selectedIncident.FeedbackEffectiveness || "—"}</p>
                        <p><strong>Quality Specialist Name:</strong> {selectedIncident.QualitySpecialistName || "—"}</p>
                        <p>
                          <strong>Feedback Date:</strong>{" "}
                          {selectedIncident.FeedbackDate
                            ? new Date(selectedIncident.FeedbackDate).toLocaleDateString("en-GB")
                            : "—"}
                        </p>
                        <p>
                          <strong>Reviewed By Manager:</strong>{" "}
                          <span className={selectedIncident.ReviewedFlag === "Yes" ? "status-Yes" : "status-No"}>
                            {selectedIncident.ReviewedFlag === "Yes" ? "Yes" : "No"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showUpdateModal && selectedIncident && (
                <div className="modal-bg active" onClick={this.closeUpdateModal}>
                  <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                    <button className="close-btn" onClick={this.closeUpdateModal}>×</button>
                    <h2>Update Incident Response</h2>
                    <form onSubmit={this.handleUpdateSubmit}>
                      <div className="section">
                        <label htmlFor="probable-causes">Incident Most Probable Causes:</label>
                        <input
                          type="text"
                          id="probable-causes"
                          defaultValue={selectedIncident.Response?.find(r => r.DepartmentID === parseInt(window.location.pathname.split("/").pop()))?.Reason || ""}
                          placeholder="Enter probable causes"
                          required
                        />
                      </div>
                      <div className="section">
                        <label htmlFor="corrective-action">Corrective / Preventive Action:</label>
                        <textarea
                          id="corrective-action"
                          rows="3"
                          defaultValue={selectedIncident.Response?.find(r => r.DepartmentID === parseInt(window.location.pathname.split("/").pop()))?.CorrectiveAction || ""}
                          placeholder="Enter corrective action"
                          required
                        />
                      </div>
                      <div className="section">
                        <label htmlFor="due-date">Due Date:</label>
                        <input
                          type="date"
                          id="due-date"
                          value={this.state.dueDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => this.setState({ dueDate: e.target.value })}
                        />
                      </div>
                      <button type="submit" className="btn-details">Submit Update</button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }
}