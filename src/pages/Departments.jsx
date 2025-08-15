import React, { Component } from "react";
import "./Departments.css";
//Features:
//1. select incident Details related to the department for only the  user who have the accessibility to this user (Sele)
//2. Submit incident Response to the quality Department (Insert)
//3. Update Status
export default class Departments extends Component {
  constructor(props) {
    super(props);
    this.state = {
      incidents: [
        {
          number: 1001,
          date: "2025-08-08",
          location: "Admin Building",
          reporter: "Sarah Ali",
          status: "New",
          responded: "No",
        },
        {
          number: 1002,
          date: "2025-08-09",
          location: "ER",
          reporter: "Ali Hassan",
          status: "Closed",
          responded: "Yes",
        },
      
      ],
      filteredIncidents: [],
      filters: {
        statusFilter: "all",
        responseFilter: "all",
        dateFrom: "",
        dateTo: "",
      },
      showDetailsModal: false,
      showUpdateModal: false,
      showQualityModal: false,
      selectedIncident: null,
    };
  }

  componentDidMount() {
    this.setState({ filteredIncidents: this.state.incidents });
  }
  // Open and Close Modal
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

  handleUpdateSubmit = (e) => {
    e.preventDefault();
    alert("Update submitted!");
    this.closeUpdateModal();
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
          <img src="alnas-hospital.png" alt="Hospital Logo" />
          <h1>IT Department Incident Management</h1>
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
                        <th>Type</th>
                        <th>Risk Scoring</th>
                        <th>Categorization</th>
                        <th>Effectiveness Result</th>
                        <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                        <td>2025-08-20</td>
                        <td><span className="status-pending">Pending</span></td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>Awaiting verification of corrective action.</td>
                    </tr>
                    <tr>
                        <td>2025-08-25</td>
                        <td><span className="status-completed">Completed</span></td>
                         <td>Near Miss Events</td>
                         <td>—</td>
                         <td>—</td>
                        <td><span className="status-effective">Effective</span></td>
                        <td>Issue resolved and verified.</td>
                      </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="section">
                <label htmlFor="quality-reply">Reply to Quality Department:</label>
                <textarea
                  id="quality-reply"
                  rows="3"
                  placeholder="Write your reply or clarification here..."
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
