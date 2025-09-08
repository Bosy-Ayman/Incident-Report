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
    };
  }

  handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    this.setState({ [name]: checked });
  };

  handleInputChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value });
  };

  handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    this.setState((prevState) => ({
      attachments: [...prevState.attachments, ...newFiles],
    }));
  };

  // ADDED: Missing handleRemoveFile function
  handleRemoveFile = (index) => {
    this.setState((prevState) => ({
      attachments: prevState.attachments.filter((_, i) => i !== index),
    }));
  };

handleSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;

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
      reportTime: new Date().toISOString().slice(0, 16),
    });
  } catch (err) {
    console.error('Error submitting form:', err);
    alert('Error submitting form:\n' + err.message);
  }
};
  render() {
    const { patientChecked, employeeChecked, visitorChecked } = this.state;

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
            <input
              type="file"
              id="attachment"
              name="attachment"
              multiple
              onChange={this.handleFileChange}
            />

            {/* Display selected files */}
            {this.state.attachments.length > 0 && (
              <ul>
                {this.state.attachments.map((file, index) => (
                  <li key={index}>
                    {file.name}
                    {file.type.startsWith("image/") && (
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        width="50"
                        style={{ marginLeft: "10px" }}
                      />
                    )}
                    <button 
                      type="button" 
                      onClick={() => this.handleRemoveFile(index)}
                      style={{ marginLeft: "10px" }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button type="submit">Submit</button>
          </form>
        </div>
      </div>
    );
  }
}