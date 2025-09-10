import React, { Component } from "react";
import "./IncidentForm.css";

export default class IncidentForm extends Component {
  constructor(props) {
    super(props);
    const currentDateTime = new Date().toISOString().slice(0, 16);
    this.state = {
      patientChecked: false,
      employeeChecked: false,
      visitorChecked: false,
      attachments: [],
      reportTime: currentDateTime,
      patient_name: "",
      employee_name: "",
      visitor_name: "",
      mrn: "",
      totalFileSize: 0,
      fileErrors: [],
    };
    this.fileInputRef = React.createRef();
    this.MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
  }

  handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    this.setState({ [name]: checked });
  };

  handleInputChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value });
  };

  formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  validateFiles = (files) => {
    const errors = [];
    const validFiles = [];
    let currentTotalSize = this.state.totalFileSize;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const newTotalSize = currentTotalSize + file.size;

      // Check if adding this file would exceed the 20MB limit
      if (newTotalSize > this.MAX_FILE_SIZE) {
        const remainingSpace = this.MAX_FILE_SIZE - currentTotalSize;
        errors.push(
          `File "${file.name}" (${this.formatFileSize(file.size)}) cannot be added. ` +
          `Only ${this.formatFileSize(remainingSpace)} remaining of 20MB limit.`
        );
      } else {
        validFiles.push(file);
        currentTotalSize = newTotalSize;
      }
    }

    return { validFiles, errors, newTotalSize: currentTotalSize };
  };

  handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    
    if (newFiles.length === 0) return;

    const { validFiles, errors, newTotalSize } = this.validateFiles(newFiles);

    this.setState((prevState) => ({
      attachments: [...prevState.attachments, ...validFiles],
      totalFileSize: newTotalSize,
      fileErrors: errors,
    }));

    // Show errors if any
    if (errors.length > 0) {
      alert("File Upload Errors:\n\n" + errors.join("\n\n"));
    }

    // Clear the input to allow re-selecting the same files if needed
    if (this.fileInputRef.current) {
      this.fileInputRef.current.value = "";
    }
  };

  handleRemoveFile = (indexToRemove) => {
    const fileToRemove = this.state.attachments[indexToRemove];
    const newAttachments = this.state.attachments.filter((_, index) => index !== indexToRemove);
    const newTotalSize = this.state.totalFileSize - fileToRemove.size;

    this.setState({
      attachments: newAttachments,
      totalFileSize: newTotalSize,
      fileErrors: [], // Clear errors when removing files
    }, () => {
      // Clear the file input completely
      if (this.fileInputRef.current) {
        this.fileInputRef.current.value = "";
      }
    });
  };

  handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;

    // Final validation before submission
    if (this.state.totalFileSize > this.MAX_FILE_SIZE) {
      alert(`Total file size (${this.formatFileSize(this.state.totalFileSize)}) exceeds 20MB limit. Please remove some files.`);
      return;
    }

    try {
      const formData = new FormData();

      // Append form fields directly from state and form elements
      formData.append('reporter_name', form.reporter_name.value);
      formData.append('reporter_title', form.reporter_title.value);
      formData.append('incident_date', form.incident_date.value);
      formData.append('incident_time', form.incident_time.value);
      formData.append('location', form.location.value);
      formData.append('description', form.description.value);
      formData.append('immediate_action', form.immediate_action.value);
      formData.append('patientChecked', this.state.patientChecked);
      formData.append('employeeChecked', this.state.employeeChecked);
      formData.append('visitorChecked', this.state.visitorChecked);
      formData.append('patient_name', this.state.patient_name);
      formData.append('employee_name', this.state.employee_name);
      formData.append('visitor_name', this.state.visitor_name);
      formData.append('mrn', this.state.mrn);
      formData.append('report_time', this.state.reportTime);

      // Append files
      this.state.attachments.forEach((file) => {
        formData.append('attachment', file);
      });

      // Log FormData for debugging
      for (let pair of formData.entries()) {
        console.log(`${pair[0]}: ${pair[1]}`);
      }

      const res = await fetch('/incident-form', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const response = await res.json();

      alert(response.message || 'Incident submitted successfully!');

      // Reset form
      form.reset();
      this.setState({
        patientChecked: false,
        employeeChecked: false,
        visitorChecked: false,
        patient_name: '',
        employee_name: '',
        visitor_name: '',
        mrn: '',
        attachments: [],
        totalFileSize: 0,
        fileErrors: [],
        reportTime: new Date().toISOString().slice(0, 16),
      });
    } catch (err) {
      console.error('Error submitting form:', err);
      alert('Error submitting form:\n' + err.message);
    }
  };

  render() {
    const { patientChecked, employeeChecked, visitorChecked, totalFileSize, fileErrors } = this.state;
    const remainingSpace = this.MAX_FILE_SIZE - totalFileSize;
    const usagePercentage = (totalFileSize / this.MAX_FILE_SIZE) * 100;

    return (
      <div>
        <header>
          <img src="alnas-hospital.png" alt="Hospital Logo" />
          <h1>Incident Report / تقرير الحادث</h1>
        </header>

        <div className="incident-container">
          <form onSubmit={this.handleSubmit}>
            <h2>Incident Information / معلومات الحادث</h2>

            <label htmlFor="incident-date">Incident Date / تاريخ الحادث</label>
            <input type="date" id="incident-date" name="incident_date" required />

            <label htmlFor="incident-location">Incident Location / مكان الحادث:</label>
            <input type="text" id="incident-location" name="location" required />

            <label htmlFor="incident-time">Incident Time / وقت الحادث:</label>
            <input type="time" id="incident-time" name="incident_time" required />

            <h2>Affected Individuals / الاشخاص المتأثرين</h2>

            {/* Patient */}
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="patient"
                name="patientChecked"
                checked={patientChecked}
                onChange={this.handleCheckboxChange}
              />
              <label htmlFor="patient">Patient / مريض</label>
            </div>

            {patientChecked && (
              <div className="sub-section">
                <label htmlFor="patient-name">Patient Name / اسم المريض:</label>
                <input
                  type="text"
                  id="patient-name"
                  name="patient_name"
                  value={this.state.patient_name}
                  onChange={this.handleInputChange}
                />

                <label htmlFor="mrn">MRN / الرقم الطبى:</label>
                <input
                  type="text"
                  id="mrn"
                  name="mrn"
                  value={this.state.mrn}
                  onChange={this.handleInputChange}
                />
              </div>
            )}

            {/* Employee */}
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="employee"
                name="employeeChecked"
                checked={employeeChecked}
                onChange={this.handleCheckboxChange}
              />
              <label htmlFor="employee">Employee / موظف</label>
            </div>

            {employeeChecked && (
              <div className="sub-section">
                <label htmlFor="employee-name">Employee Name / اسم الموظف:</label>
                <input
                  type="text"
                  id="employee-name"
                  name="employee_name"
                  value={this.state.employee_name}
                  onChange={this.handleInputChange}
                />
              </div>
            )}

            {/* Visitor */}
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="visitor"
                name="visitorChecked"
                checked={visitorChecked}
                onChange={this.handleCheckboxChange}
              />
              <label htmlFor="visitor">Visitor / زائر</label>
            </div>

            {visitorChecked && (
              <div className="sub-section">
                <label htmlFor="visitor-name">Visitor Name / اسم الزائر:</label>
                <input
                  type="text"
                  id="visitor-name"
                  name="visitor_name"
                  value={this.state.visitor_name}
                  onChange={this.handleInputChange}
                />
              </div>
            )}

            <h2>Incident Description / وصف الحادث</h2>
            <textarea
              id="incident-description"
              name="description"
              rows="4"
              placeholder="Describe the incident here"
              required
            ></textarea>

            <h2>Immediate Action Taken / الاجراء الفورى الذى نفذ</h2>
            <textarea
              id="immediate-action"
              name="immediate_action"
              rows="4"
              required
            ></textarea>

            <label htmlFor="reporter-name">Reporter's Name / اسم المبلغ:</label>
            <input type="text" id="reporter-name" name="reporter_name" required />

            <label htmlFor="reporter-title">Reporter Title / وظيفه المبلغ:</label>
            <input type="text" id="reporter-title" name="reporter_title" required />

            <label htmlFor="attachment">
              Attach a copy of related documents (if any) <br />
              (ان وجدت) ارفق نسخه من المتعلقات
            </label>
            
            {/* File size usage indicator */}
            <div style={{ marginBottom: "10px", fontSize: "14px" }}>
              <div style={{ 
                backgroundColor: "#f0f0f0", 
                borderRadius: "10px", 
                height: "20px", 
                position: "relative",
                border: "1px solid #ccc"
              }}>
                <div style={{ 
                  backgroundColor: usagePercentage > 90 ? "#ff4444" : usagePercentage > 70 ? "#ffaa00" : "#4CAF50", 
                  height: "100%", 
                  width: `${usagePercentage}%`, 
                  borderRadius: "10px",
                  transition: "all 0.3s ease"
                }}></div>
              </div>
              <span style={{ color: usagePercentage > 90 ? "#ff4444" : "#666" }}>
                Used: {this.formatFileSize(totalFileSize)} / 20MB 
                (Remaining: {this.formatFileSize(remainingSpace)})
              </span>
            </div>

            <input
              type="file"
              id="attachment"
              name="attachment"
              multiple
              ref={this.fileInputRef}
              onChange={this.handleFileChange}
              disabled={remainingSpace <= 0}
            />

            {remainingSpace <= 0 && (
              <p style={{ color: "#ff4444", fontSize: "14px", margin: "5px 0" }}>
                Upload limit reached. Please remove some files to add more.
              </p>
            )}

            {/* Display file errors */}
            {fileErrors.length > 0 && (
              <div style={{ 
                backgroundColor: "#ffe6e6", 
                border: "1px solid #ff9999", 
                borderRadius: "5px", 
                padding: "10px", 
                margin: "10px 0",
                fontSize: "14px"
              }}>
                <strong>File Upload Warnings:</strong>
                <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                  {fileErrors.map((error, index) => (
                    <li key={index} style={{ color: "#cc0000" }}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Display selected files */}
            {this.state.attachments.length > 0 && (
              <div style={{ marginTop: "15px" }}>
                <h4>Selected Files ({this.state.attachments.length}):</h4>
                <ul>
                  {this.state.attachments.map((file, index) => (
                    <li key={index} style={{ marginBottom: "10px", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "5px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {/* File name and size */}
                          <div>
                            <div style={{ fontWeight: "bold" }}>{file.name}</div>
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              {this.formatFileSize(file.size)}
                            </div>
                          </div>

                          {/* Show preview only for images */}
                          {file.type.startsWith("image/") && (
                            <img
                              src={URL.createObjectURL(file)}
                              alt="preview"
                              width="50"
                              height="50"
                              style={{ 
                                marginLeft: "15px", 
                                borderRadius: "5px",
                                objectFit: "cover"
                              }}
                            />
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => this.handleRemoveFile(index)}
                          style={{ 
                            backgroundColor: "#ff4444",
                            color: "white",
                            border: "none",
                            padding: "5px 10px",
                            borderRadius: "3px",
                            cursor: "pointer"
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button 
              type="submit" 
              className="submit-btn"
              disabled={totalFileSize > this.MAX_FILE_SIZE}
              style={{
                opacity: totalFileSize > this.MAX_FILE_SIZE ? 0.6 : 1,
                cursor: totalFileSize > this.MAX_FILE_SIZE ? "not-allowed" : "pointer"
              }}
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    );
  }
}