import React, { Component } from "react";
import "./Departments.css";
//Features:
//1. select incident Details related to the department for only the  user who have the accessibility to this user (Select)
//2. Submit incident Response to the quality Department (Insert)
//3. Update Status

export default class Departments extends Component {
  constructor(props) {
    super(props);
    this.state = {
      incidents: [],
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
      showUpdateModal: false,
      showQualityModal: false,
    };
  }

  async componentDidMount() {
    const urlParts = window.location.pathname.split("/");
    const departmentId = urlParts[urlParts.length - 1];

    try {
      const res = await fetch(`/departments/${departmentId}`);
      const data = await res.json();

      if (data.status === "success" && Array.isArray(data.data)) {
        this.setState({ 
          incidents: data.data, 
          filteredIncidents: data.data, 
          departmentName: data.data[0]?.DepartmentName || `Department ${departmentId}`
        });
      }
    } catch (err) {
      console.error(err);
      this.setState({ departmentName: `Department ${departmentId}` });
    }
  }

  openDetailsModal = (incident) => {
    this.setState({ showDetailsModal: true, selectedIncident: incident });
  };

  closeDetailsModal = () => {
    this.setState({ showDetailsModal: false, selectedIncident: null });
  };

  openUpdateModal = (incident) => {
    this.setState({ showUpdateModal: true, selectedIncident: incident });
  };

  closeUpdateModal = () => {
    this.setState({ showUpdateModal: false, selectedIncident: null });
  };

  openQualityModal = (incident) => {
    this.setState({ showQualityModal: true, selectedIncident: incident });
  };

  closeQualityModal = () => {
    this.setState({ showQualityModal: false, selectedIncident: null });
  };

  handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const { selectedIncident } = this.state;

    if (!selectedIncident) {
      alert("No incident selected!");
      return;
    }

    const probableCauses = e.target["probable-causes"].value;
    const correctiveAction = e.target["corrective-action"].value;
    const dueDate = e.target["due-date"].value;

    // Extract departmentId from URL
    const urlParts = window.location.pathname.split("/");
    const departmentId = parseInt(urlParts[urlParts.length - 1]);

    if (!departmentId) {
      alert("Department ID not found in URL!");
      return;
    }

    const body = {
      ResponseID: selectedIncident.ResponseID,
      IncidentID: selectedIncident.number,    
      DepartmentID: departmentId,            
      Reason: probableCauses,
      CorrectiveAction: correctiveAction,
      ResponseDate: dueDate,
    };

    try {
      const res = await fetch("/department-response", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    this.setState((prev) => ({
      filters: {
        ...prev.filters,
        [id]: value,
      },
    }));
  };

  applyFilters = () => {
    const { incidents, filters } = this.state;
    let filtered = [];

    for (let i = 0; i < incidents.length; i++) {
      const inc = incidents[i];

      if (filters.statusFilter !== "all" && inc.status !== filters.statusFilter) continue;

      if (filters.responseFilter !== "all") {
        if (inc.responded.toLowerCase() !== filters.responseFilter.toLowerCase()) continue;
      }

      if (filters.dateFrom && inc.date < filters.dateFrom) continue;

      if (filters.dateTo && inc.date > filters.dateTo) continue;

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

  render() {
    const {
      filteredIncidents,
      filters,
      showDetailsModal,
      showUpdateModal,
      showQualityModal,
      selectedIncident,
    } = this.state;

    return (
      <div className="quality-dashboard">
      <header>
      <img src="/alnas-hospital.png" alt="Hospital Logo" />
      <h1>{this.state.departmentName} Department Incident Management</h1>
      </header>
        <main>
          {/* Filters */}
          <div id="filters">
            <label htmlFor="statusFilter">Status:</label>
            <select id="statusFilter" value={filters.statusFilter} onChange={this.handleFilterChange}>
              <option value="all">All</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="PendingResponse">Pending Response</option>
              <option value="Closed">Closed</option>
            </select>

            <label htmlFor="responseFilter">Responded by Dept:</label>
            <select id="responseFilter" value={filters.responseFilter} onChange={this.handleFilterChange}>
              <option value="all">All</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>

            <label htmlFor="dateFrom">From Date:</label>
            <input
              type="date"
              id="dateFrom"
              value={filters.dateFrom}
              onChange={this.handleFilterChange}
            />

            <label htmlFor="dateTo">To Date:</label>
            <input
              type="date"
              id="dateTo"
              value={filters.dateTo}
              onChange={this.handleFilterChange}
            />

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
                <th>Responded by Dept</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredIncidents.map((incident) => (
                <tr
                  key={incident.number}
                  data-status={incident.status}
                  data-responded={incident.responded}
                  data-date={incident.date}
                >
                  <td>{incident.number}</td>
                  <td>{incident.date}</td>
                  <td>{incident.location}</td>
                  <td>{incident.reporter}</td>
                  <td className={`status-${incident.status.replace(/\s/g, "")}`}>
                    {incident.status}
                  </td>
                  <td>{incident.responded}</td>
                  <td>
                    <button
                      className="btn-details"
                      onClick={() => this.openDetailsModal(incident)}
                    >
                      Details
                    </button>
                    <button
                      className="btn-update"
                      onClick={() => this.openUpdateModal(incident)}
                      style={{ marginLeft: "10px" }}
                    >
                      Update
                    </button>
                    <button
                      className="btn-quality"
                      onClick={() => this.openQualityModal(incident)}
                      style={{ marginLeft: "10px" }}
                    >
                      Quality Response
                    </button>
                  </td>
                </tr>
              ))}
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
                  <p>
                    <strong>Incident No:</strong> {selectedIncident.number}
                  </p>
                  <p>
                    <strong>Date:</strong> {selectedIncident.date}
                  </p>
                  <p>
                    <strong>Location:</strong> {selectedIncident.location}
                  </p>
                  <p>
                    <strong>Reporter:</strong> {selectedIncident.reporter}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedIncident.status}
                  </p>
                  <p>
                    <strong>Responded:</strong> {selectedIncident.responded}
                  </p>
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
            <h2 id="update-title">Update Incident Response</h2>

            {selectedIncident && (
              <form onSubmit={this.handleUpdateSubmit}>
                <div className="section">
                  <label htmlFor="probable-causes">Incident Most Probable Causes:</label>
                  <input
                    type="text"
                    id="probable-causes"
                    placeholder="Enter probable causes"
                    required
                  />
                </div>

                <div className="section">
                  <label htmlFor="corrective-action">Corrective / Preventive Action:</label>
                  <textarea
                    id="corrective-action"
                    rows="3"
                    placeholder="Enter corrective action"
                    required
                  />
                </div>

                <div className="section">
                  <label htmlFor="due-date">Due Date:</label>
                  <input type="date" id="due-date" required />
                </div>

                <button type="submit" className="btn-update">
                  Submit Update
                </button>
              </form>
            )}
          </div>
        </div>
         {/* Quality Response Modal */}
          <div
            className={`modal-bg ${showQualityModal ? "active" : ""}`}
            onClick={this.closeQualityModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quality-title"
          >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <button
                className="close-btn"
                onClick={this.closeQualityModal}
                aria-label="Close quality modal"
              >
                ×
              </button>
              
              <h2 id="quality-title"> Follow-Up</h2>
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
                    <tr>
                        <td>-</td>
                        <td><span className="status-pending">-</span></td>
                        <td>—</td>
                        <td>-</td>
                    </tr>

                  </tbody>
                </table>
              </div>
              
              <div className="section">
                <label htmlFor="quality-reply">Reply to Quality Department:</label>
                <textarea
                  id="quality-reply"
                  rows="3"
                ></textarea>
                <br />
                <button
                  className="btn-quality"
                  onClick={() => alert("Reply sent!")}
                >
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }
}
