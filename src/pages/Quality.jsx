import React, { Component } from "react";
import { useLocation } from "react-router-dom";
import "./Quality.css";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}
export default class Quality extends Component {
  
  constructor(props) {
    super(props);
    this.state = {
      incidents: [],
      departments: [],
      incidentResponses: [],
      filteredIncidents: [],
      showDetailsModal: false,
      showUpdateModal: false,
      selectedIncident: null,
      selectedDepartmentId: "",
      categorization: "",
      qualitySpecialistName: "",
      reviewedFlag:'',
      type: [],
      riskScoring: "",
      effectiveness: "",
      feedbackFlag: "",
      ReviewedFlag: "",
      showCloseModal: false,
      currentUserId: null, 
      filters:{
        statusFilter: "all",
        responseFilter: "all",
        dateFrom: "",
        dateTo: "",
      }
    };
  }

  async componentDidMount() {
    try {
      const token = localStorage.getItem("token");
      
      // Get current user ID from localStorage
      let currentUserId = localStorage.getItem("userId") || 
                          localStorage.getItem("userID") || 
                          localStorage.getItem("UserID");
      
      // Convert to number if it's a string
      if (currentUserId) {
        currentUserId = parseInt(currentUserId);
      }
      
      console.log("Debug - currentUserId from localStorage:", currentUserId);
      
      this.setState({ currentUserId });

      // Fetch incidents and departments in parallel
      const [incidentsRes, departmentsRes] = await Promise.all([
        fetch("/quality", { 
          headers: { "Authorization": `Bearer ${token}` }, 
          credentials: "include" 
        }),
        fetch("/departments", { 
          headers: { "Authorization": `Bearer ${token}` }, 
          credentials: "include" 
        })
      ]);

      // Parse JSON responses
      const incidentsData = await incidentsRes.json();
      const departmentsData = await departmentsRes.json();

      // Normalize arrays
      const incidentsArray = Array.isArray(incidentsData.data) ? incidentsData.data : [];
      const departmentsArray = Array.isArray(departmentsData) ? departmentsData : [];

      // Map incidents and include responses with corrected field mapping
      const incidentsWithFeedback = incidentsArray.map(inc => ({
        ...inc,
        // Check if quality feedback exists by looking for any quality-related fields
        feedbackFlag: (inc.FeedbackFlag === 1 || 
                      inc.FeedbackCategorization || 
                      inc.FeedbackType || 
                      inc.FeedbackRiskScoring || 
                      inc.FeedbackEffectiveness) ? "true" : "false",
        reviewedFlag: (inc.ReviewedFlag === "true" || inc.ReviewedFlag === "Yes") ? "true" : "false",
        type: inc.FeedbackType ? inc.FeedbackType.split(", ") : [],
        riskScoring: inc.FeedbackRiskScoring || "",
        effectiveness: inc.FeedbackEffectiveness || "",
        qualitySpecialistName: inc.QualitySpecialistName || "",
        Response: inc.Responses ? JSON.parse(inc.Responses) : [] 
      }));

      // Update state
      this.setState({
        incidents: incidentsWithFeedback,
        filteredIncidents: incidentsWithFeedback,
        departments: departmentsArray
      });

    } catch (err) {
      console.error("Error fetching data in componentDidMount:", err);
    }
  }

  handleReviewedByManager = () => {
    const { selectedIncident, currentUserId } = this.state;
    if (!selectedIncident) return;

    // Check if current user is authorized (user ID 1033)
    if (currentUserId !== 1033) {
      alert("You are not authorized to review incidents.");
      return;
    }

    const token = localStorage.getItem("token");

    fetch("/review-incident", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      credentials: "include",
      body: JSON.stringify({
        incidentId: selectedIncident.IncidentID,
        reviewed: true
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        alert("Incident marked as reviewed successfully!");
        this.setState(prevState => {
          const updatedIncidents = prevState.incidents.map(inc =>
            inc.IncidentID === selectedIncident.IncidentID
              ? { ...inc, reviewedFlag: "true" }
              : inc
          );
          return { 
            incidents: updatedIncidents, 
            filteredIncidents: updatedIncidents,
            showDetailsModal: false // Close modal after successful review
          };
        });
      } else {
        alert("Failed to mark as reviewed: " + (data.message || "Unknown error"));
      }
    })
    .catch(err => {
      console.error(err);
      alert("Failed to mark as reviewed: " + err.message);
    });
  };

  /*Details Modal*/
  openDetailsModal = (incident) => {
    const responses = incident.Response || [];
  
    const qualityData = {
      categorization: incident.FeedbackCategorization || "",
      type: incident.FeedbackType ? incident.FeedbackType.split(", ") : [],
      riskScoring: incident.FeedbackRiskScoring || "",
      effectiveness: incident.FeedbackEffectiveness || "",
      qualitySpecialistName: incident.QualitySpecialistName || "",
      feedbackFlag: incident.feedbackFlag || "",
    };

    this.setState({
      showDetailsModal: true,
      selectedIncident: { ...incident, Response: responses, ...qualityData }
    });
  };

  closeDetailsModal= ()=> {
    this.setState({ showDetailsModal: false, selectedIncident: null });
  };

  openUpdateModal = (incident) => {
    // Auto-populate quality specialist name from login
    const loggedInUserName = localStorage.getItem("userName") || "";
    
    const qualityData = {
      categorization: incident.FeedbackCategorization || "",
      type: incident.FeedbackType ? incident.FeedbackType.split(", ") : [],
      riskScoring: incident.FeedbackRiskScoring || "",
      effectiveness: incident.FeedbackEffectiveness || "",
      qualitySpecialistName: incident.QualitySpecialistName,
      feedbackFlag: incident.feedbackFlag || "",
    };

    this.setState({
      showUpdateModal: true,
      selectedIncident: { ...incident, ...qualityData },
      categorization: qualityData.categorization,
      type: qualityData.type,
      riskScoring: qualityData.riskScoring,
      effectiveness: qualityData.effectiveness,
      qualitySpecialistName: qualityData.qualitySpecialistName,
      feedbackFlag: qualityData.feedbackFlag,
    });
  };

  /*Close Incident State*/
  confirmCloseIncident = () => {
    const { selectedIncident } = this.state;
    if (!selectedIncident) return;

    console.log("Closing incident:", selectedIncident); 
    fetch('/quality/close-incident', {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ IncidentID: selectedIncident.IncidentID })
    })
    .then(res => res.json())
    .then((data) => {
      if (data.status === "success") {
        alert("Incident closed successfully!");
        // Update local state instead of full refresh
        this.setState(prevState => {
          const updatedIncidents = prevState.incidents.map(inc =>
            inc.IncidentID === selectedIncident.IncidentID
              ? { ...inc, status: 'Done' }
              : inc
          );
          return { 
            incidents: updatedIncidents, 
            filteredIncidents: updatedIncidents 
          };
        });
      } else {
        alert("Failed to close incident: " + data.message);
      }
    })
    .catch(err => {
      console.error("Error closing incident:", err);
      alert("Failed to close incident.");
    });
  };

  closeUpdateModal= ()=> {
    this.setState({ 
      showUpdateModal: false,
      selectedIncident: null 
    });
  };

  /*Filter based on the status ,date ,and whether the department responded or not*/
  applyFilters = () => {
    const { incidents, filters } = this.state;
    let filtered = [];

    for (let i = 0; i < incidents.length; i++) {
      const inc = incidents[i];

      // Filter by status
      if (filters.statusFilter !== "all" && inc.status !== filters.statusFilter) {
        continue;
      }

      // Filter by response (Yes/no)
      if (filters.responseFilter !== "all" && inc.responded.toLowerCase() !== filters.responseFilter.toLowerCase()) {
        continue;
      }
      // Filter by date range
      if (filters.dateFrom && new Date(inc.IncidentDate) < new Date(filters.dateFrom)) {
        continue;
      }
      if (filters.dateTo && new Date(inc.IncidentDate) > new Date(filters.dateTo)) {
        continue;
      }
      // Passed all filters
      filtered.push(inc);
    }

    this.setState({ filteredIncidents: filtered });
  };

  clearFilters = () => {
    this.setState(
      {
        filters: { statusFilter: "all", responseFilter: "all", dateFrom: "", dateTo: "" },
        filteredIncidents: this.state.incidents,
      }
    );
  };

  handleFilterChange=(e)=>{
    const {id,value} = e.target;
    this.setState((prev)=> ({
      filters:{
        ...prev.filters,
        [id]:value,
      },
    }));
  };

  handleUpdateSubmit = (e) => {
    e.preventDefault();
    const { selectedIncident, categorization, type, riskScoring, effectiveness,qualitySpecialistName } = this.state;

    if (!selectedIncident?.IncidentID) {
      alert("IncidentID is missing!");
      return;
    }

    // Validate required fields
    if (!categorization.trim()) {
      alert("Please provide a categorization.");
      return;
    }

    if (!type || type.length === 0) {
      alert("Please select at least one type.");
      return;
    }

    if (!riskScoring) {
      alert("Please select a risk scoring.");
      return;
    }

    if (!effectiveness) {
      alert("Please select effectiveness review.");
      return;
    }
    const token = localStorage.getItem("token");

    // Submit quality feedback
    fetch("/quality-feedback", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
      credentials: "include", 
      body: JSON.stringify({
        incidentId: selectedIncident.IncidentID,
        type: type.join(", "),
        categorization,
        riskScoring,
        effectiveness,
        qualitySpecialistName,
      })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.status === "success") {
        alert("Feedback submitted successfully!");
        
        // Update local state so correct button shows
        this.setState(prevState => {
          const updatedIncidents = prevState.incidents.map(inc =>
            inc.IncidentID === selectedIncident.IncidentID
            ? {
                ...inc,
                feedbackFlag: "true",
                reviewedFlag: "false",   
                FeedbackCategorization: categorization,
                FeedbackType: type.join(", "),
                FeedbackRiskScoring: riskScoring,
                FeedbackEffectiveness: effectiveness,
                QualitySpecialistName: qualitySpecialistName
              } 
            : inc
          );
          
          return {
            incidents: updatedIncidents,
            filteredIncidents: updatedIncidents,
            showUpdateModal: false,
            selectedIncident: null,
            // Reset form fields
            categorization: "",
            type: [],
            riskScoring: "",
            effectiveness: "",
            Description:"",
            qualitySpecialistName: ""
          };
        });
      } else {
        alert("Failed to save feedback: " + (data.message || "Unknown error"));
      }
    })
    .catch(err => {
      console.error("Error submitting feedback:", err);
      alert("Failed to save feedback: " + err.message);
    });
  };

  /* Update Quality Feedback */
  handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    this.setState(prev => {
      const newType = checked ? [...prev.type, value] : prev.type.filter(t => t !== value);
      return { type: newType };
    });
  };
  
  handleAssignDepartment = () => {
    const { selectedIncident, selectedDepartmentId } = this.state;
    
    fetch("/quality", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        incidentId: selectedIncident.IncidentID,
        departmentId: selectedDepartmentId
      })
    })
    .then(res => res.json())
    .then(() => {
      // Update local state instead of full refresh
      this.setState(prevState => {
        const updatedIncidents = prevState.incidents.map(inc =>
          inc.IncidentID === selectedIncident.IncidentID
            ? { 
                ...inc, 
                status: 'Assigned',
                DepartmentID: selectedDepartmentId,
                DepartmentName: this.state.departments.find(d => d.DepartmentID == selectedDepartmentId)?.DepartmentName || inc.DepartmentName
              }
            : inc
        );
        return {
          incidents: updatedIncidents,
          filteredIncidents: updatedIncidents,
          showDetailsModal: false, 
          selectedDepartmentId: "" 
        };
      });
    })
    .catch(err => console.error("Error assigning department:", err));
  };

  // Function to determine which button to show
getActionButton = (incident) => {
    const { currentUserId } = this.state;
    
    // If incident is already closed/done, don't show any action buttons
    if (incident.status === "Done" || incident.status === "Closed") {
      return null;
    }
    
    // If no feedback has been added yet AND department has responded, show "Add Feedback" button
    if (incident.feedbackFlag !== "true" && incident.responded === "Yes") {
      return (
        <button
          className="update-btn"
          onClick={() => this.openUpdateModal(incident)}
          style={{ marginLeft: "10px" }}
        >
          Add Feedback
        </button>
      );
    }
    
    // If feedback exists but not reviewed, show "Reviewed" button (only for user 1033)
    if (incident.feedbackFlag === "true" && incident.reviewedFlag !== "true") {
      // Make sure we're comparing the right types
      if (currentUserId === 1033 || currentUserId === "1033") {
        return (
          <button
            className="reviewed-button"
            onClick={() => {
              this.setState({ selectedIncident: incident }, () => {
                this.handleReviewedByManager();
              });
            }}
            style={{ marginLeft: "10px" }}
          >
            Reviewed
          </button>
        );
      } else {
        return (
          <span style={{ marginLeft: "10px", fontStyle: "italic", color: "#666" }}>
            Awaiting Review
          </span>
        );
      }
    }
    
    // If feedback exists and has been reviewed, show "Done" button (only if not already done)
    if (incident.feedbackFlag === "true" && incident.reviewedFlag === "true" && incident.status !== "Done") {
      return (
        <button
          className="close-button"
          onClick={() => {
            this.setState({ selectedIncident: incident }, () => {
              this.confirmCloseIncident();
            });
          }}
          style={{ marginLeft: "10px" }}
        >
          Done
        </button>
      );
    }
    
    return null;
  };

  render() {
    const {
      showDetailsModal,
      showUpdateModal,
      selectedIncident,
      filteredIncidents,
      filters
    } = this.state;

    return (
      <div className="quality-dashboard">
          {/* Filters */}
          <div id="filters">
            <label htmlFor="statusFilter">Status:</label>
            <select id="statusFilter" value={filters.statusFilter} onChange={this.handleFilterChange}>
            <option value="all">All</option>
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="Pending">Pending Response</option> 
            <option value="Done">Closed</option>
            </select>

            <label htmlFor="responseFilter">Responded by Dept:</label>
            <select id="responseFilter" value={filters.responseFilter} onChange={this.handleFilterChange}>
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>

            <label htmlFor="dateFrom">From Date:</label>
            <input 
            type="date"
            id="dateFrom" 
            value={filters.dateFrom}
            onChange={this.handleFilterChange}
            />

            <label htmlFor="dateTo">To Date:</label>
            <input type="date"
             id="dateTo" 
            value={filters.dateTo}
            onChange={this.handleFilterChange}
             />

            <button onClick={this.applyFilters}>Filter</button>
            <button onClick={this.clearFilters}>Clear</button>
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
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center" }}>
                    No incidents found.
                  </td>
                </tr>
              ) : (
           filteredIncidents.map((incident) => (
            <tr
              key={incident.IncidentID}
              data-status={incident.status}
              data-responded={incident.responded}
              data-date={new Date(incident.IncidentDate).toLocaleDateString()}
            >
              <td>{incident.IncidentID}</td>
              <td>{new Date(incident.IncidentDate).toLocaleDateString()}</td>
              <td>{incident.Location}</td>
              <td>{incident.ReporterName}</td>
              <td className={`status-${incident.status}`}>{incident.status}</td>
              
              <td className={incident.responded === "Yes" ? "status-Yes" : "status-No"}>
                {incident.responded === "Yes" ? "Yes" : "No"}
              </td>
              
              <td>
                <button
                  className="details-btn"
                  onClick={() => this.openDetailsModal(incident)}
                >
                  Details
                </button>

                {/* Use the new function to determine which button to show */}
                {this.getActionButton(incident)}
              </td>
            </tr>
          ))
              )}
            </tbody>
          </table>
          
          {/* Details Modal - keeping the existing modal code */}
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
                      <strong>Incident Description:</strong> {selectedIncident.IncidentDescription || "—"}
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
                  <p><strong>Categorization:</strong> {selectedIncident.categorization || "—"}</p>
                  <p><strong>Type:</strong> {Array.isArray(selectedIncident.type) ? selectedIncident.type.join(", ") : selectedIncident.type || "—"}</p>
                  <p><strong>Risk Scoring:</strong> {selectedIncident.riskScoring || "—"}</p>
                  <p><strong>Effectiveness:</strong> {selectedIncident.effectiveness || "—"}</p>
                  <p><strong>Quality Specialist Name:</strong> {selectedIncident.qualitySpecialistName|| "—"}</p>
                  <p>
                    <strong>Feedback Date:</strong>{" "}
                    {selectedIncident.FeedbackDate
                      ? new Date(selectedIncident.FeedbackDate).toLocaleDateString("en-GB") 
                      : "—"}
                  </p>
                  <p><strong>Reviewed By Manager:</strong><span className={selectedIncident.ReviewedFlag === "Yes" ? "status-Yes" : "status-No"}>
                        {selectedIncident.reviewedFlag === "true" ? "Yes" : "No"}
                      </span>
                    </p>
                  </div>
                </div>
              </>
            )}
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
              <h1>Quality Feedback</h1>

              <div className="section">
                <h3>Categorization</h3>
                <textarea
                  value={this.state.categorization}
                  onChange={(e) => this.setState({ categorization: e.target.value })}
                  rows="2"
                  placeholder=""
                />

                <h3>Type</h3>
                <div className="checkbox-group">
                  {["Near Miss Events", "Adverse Events", "Significant Events", "Sentinel Events"].map((item) => (
                    <label key={item}>
                      <input
                        type="checkbox"
                        name="type"
                        value={item}
                        onChange={this.handleCheckboxChange}
                        checked={this.state.type.includes(item)}
                      />
                      <strong>{item}</strong>
                    </label>
                  ))}
                </div>
                
                <h3>Risk Scoring</h3>
                <div id="filters">
                <select
                  value={this.state.riskScoring}
                  onChange={(e) => this.setState({ riskScoring: e.target.value })}
                >
                  <option value="">Select Risk</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
                </div>

                <h3>Corrective/Preventive Action Effectiveness Review</h3>
                <div id="filters">
                <select
                  value={this.state.effectiveness}
                  onChange={(e) => this.setState({ effectiveness: e.target.value })}
                >
                  <option value="">Select Effectiveness</option>
                  <option value="Effective">Effective (OVR Closed)</option>
                  <option value="Ineffective">Ineffective (Needs another action)</option>
                </select>
                </div>
              </div>
              <button type="submit" className="btn-quality">
                Submit Update
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
}