import React, { Component } from "react";
import "./Departments.css";

export default class Departments extends Component {
  constructor(props) {
    super(props);
    this.state = {
      incidents: [],
      filteredIncidents: [],
      filters: {
        statusFilter: "all",
        responseFilter: "all",
        dateFrom: "",
        dateTo: ""
      },
      showDetailsModal: false,
      showUpdateModal: false,
      showQualityModal: false,
      selectedIncident: null
    };
  }

  async componentDidMount() {
    const urlParts = window.location.pathname.split("/");
    const departmentId = urlParts[urlParts.length - 1];

    if (!departmentId || isNaN(departmentId)) {
      console.error("Invalid departmentId in URL");
      return;
    }

    try {
      const res = await fetch(`/departments/${departmentId}`);
      if (!res.ok) throw new Error("Network response was not ok");

      const data = await res.json();
      console.log("Fetched department data:", JSON.stringify(data, null, 2));

      if (data.status === "success" && Array.isArray(data.data)) {
        this.setState({ incidents: data.data, filteredIncidents: data.data });
      } else {
        console.error("Unexpected data format:", data);
      }
    } catch (err) {
      console.error("Fetch failed:", err);
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
  openQualityModal = (incident) => this.setState({
     showQualityModal: true, 
     selectedIncident: incident 
    });
  closeQualityModal = () => this.setState({ 
    showQualityModal: false, selectedIncident: null
   });

  handleUpdateSubmit = (e) => {
    e.preventDefault();
    alert("Update submitted!");
    this.closeUpdateModal();
  };

  handleFilterChange = (e) => {
    const { id, value } = e.target;
    this.setState((prev) => ({
      filters: { ...prev.filters, [id]: value }
    }));
  };

  applyFilters = () => {
    const { incidents, filters } = this.state;

    const filtered = incidents.filter((inc) => {
      const incidentDate = new Date(inc.date);
      const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
      const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

      if (filters.statusFilter !== "all" && inc.status !== filters.statusFilter) return false;
      if (filters.responseFilter !== "all" && inc.responded.toLowerCase() !== filters.responseFilter.toLowerCase()) return false;
      if (fromDate && incidentDate < fromDate) return false;
      if (toDate && incidentDate > toDate) return false;

      return true;
    });

    this.setState({ filteredIncidents: filtered });
  };

  clearFilters = () => {
    this.setState((prev) => ({
      filters: { statusFilter: "all", responseFilter: "all", dateFrom: "", dateTo: "" },
      filteredIncidents: prev.incidents
    }));
  };

  render() {
    const {
      filteredIncidents,
      filters,
      showDetailsModal,
      showUpdateModal,
      showQualityModal,
      selectedIncident
    } = this.state;

    return (
      <div className="quality-dashboard">
        <header>
          <img src="alnas-hospital.png" alt="Hospital Logo" />
          <h1>{sessionStorage.getItem("departmentName")} Department Incident Management</h1>
        </header>

        <main>
          {/* Filters */}
          <div id="filters">
            <label>Status:</label>
            <select id="statusFilter" value={filters.statusFilter} onChange={this.handleFilterChange}>
              <option value="all">All</option>
              <option value="New">New</option>
              <option value="Assigned">Assigned</option>
              <option value="PendingResponse">Pending Response</option>
              <option value="Closed">Closed</option>
            </select>

            <label>Responded by Dept:</label>
            <select id="responseFilter" value={filters.responseFilter} onChange={this.handleFilterChange}>
              <option value="all">All</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>

            <label>From Date:</label>
            <input type="date" id="dateFrom" value={filters.dateFrom} onChange={this.handleFilterChange} />
            <label>To Date:</label>
            <input type="date" id="dateTo" value={filters.dateTo} onChange={this.handleFilterChange} />

            <button onClick={this.applyFilters}>Filter</button>
            <button onClick={this.clearFilters}>Clear</button>
          </div>

          {/* Debug JSON */}
          <pre>{JSON.stringify(filteredIncidents, null, 2)}</pre>

          {/* Incidents Table */}
          <table id="incidentTable">
            <thead>
              <tr>
                <th>Incident No</th>
                <th>Date</th>
                <th>Location</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Responded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((incident) => (
                <tr key={incident.number}>
                  <td>{incident.number}</td>
                  <td>{incident.date}</td>
                  <td>{incident.location}</td>
                  <td>{incident.reporter}</td>
                  <td className={`status-${incident.status.replace(/\s/g, "")}`}>{incident.status}</td>
                  <td>{incident.responded}</td>
                  <td>
                    <button onClick={() => this.openDetailsModal(incident)}>Details</button>
                    <button onClick={() => this.openUpdateModal(incident)}>Update</button>
                    <button onClick={() => this.openQualityModal(incident)}>Quality Response</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Modals */}
          {selectedIncident && (
            <>
              {/* Details Modal */}
              <div className={`modal-bg ${showDetailsModal ? "active" : ""}`} onClick={this.closeDetailsModal}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                  <button className="close-btn" onClick={this.closeDetailsModal}>×</button>
                  <h2>Incident Details</h2>
                  <p><strong>Incident No:</strong> {selectedIncident.number}</p>
                  <p><strong>Date:</strong> {selectedIncident.date}</p>
                  <p><strong>Location:</strong> {selectedIncident.location}</p>
                  <p><strong>Reporter:</strong> {selectedIncident.reporter}</p>
                  <p><strong>Status:</strong> {selectedIncident.status}</p>
                  <p><strong>Responded:</strong> {selectedIncident.responded}</p>
                </div>
              </div>

              {/* Update Modal */}
              <div className={`modal-bg ${showUpdateModal ? "active" : ""}`} onClick={this.closeUpdateModal}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                  <button className="close-btn" onClick={this.closeUpdateModal}>×</button>
                  <h2>Update Incident Response</h2>
                  <form onSubmit={this.handleUpdateSubmit}>
                    <label>Incident Most Probable Causes:</label>
                    <input type="text" placeholder="Enter probable causes" required />
                    <label>Corrective / Preventive Action:</label>
                    <textarea rows="3" placeholder="Enter corrective action" required />
                    <label>Due Date:</label>
                    <input type="date" required />
                    <button type="submit">Submit Update</button>
                  </form>
                </div>
              </div>

              {/* Quality Modal */}
              <div className={`modal-bg ${showQualityModal ? "active" : ""}`} onClick={this.closeQualityModal}>
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                  <button className="close-btn" onClick={this.closeQualityModal}>×</button>
                  <h2>Follow-Up</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Follow-Up Date</th>
                        <th>Status</th>
                        <th>Effectiveness</th>
                        <th>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>2025-08-20</td>
                        <td>Pending</td>
                        <td>—</td>
                        <td>Awaiting verification of corrective action.</td>
                      </tr>
                    </tbody>
                  </table>
                  <textarea rows="3" placeholder="Write your reply"></textarea>
                  <button onClick={() => alert("Reply sent!")}>Send Reply</button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    );
  }
}
