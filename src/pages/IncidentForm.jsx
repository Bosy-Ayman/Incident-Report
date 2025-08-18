import React, { Component } from "react";
import "./IncidentForm.css";

export default class IncidentForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      patientChecked: false,
      employeeChecked: false,
      visitorChecked: false,
      attachments: [],
    };
  }

  handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    this.setState({ [name]: checked });
  };

  handleSubmit = (event) => {
    event.preventDefault(); 

    const form = event.target;
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });

    data.patientChecked = this.state.patientChecked;
    data.employeeChecked = this.state.employeeChecked;
    data.visitorChecked = this.state.visitorChecked;
   
    // Post: so that it can recieve the form info into the database
    fetch("/incident-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((response) => {
        alert(response.message);
        form.reset(); 
        this.setState({
          patientChecked: false,
          employeeChecked: false,
          visitorChecked: false,
        });
      })
      .catch((err) => {
        alert("Error submitting form");
        console.error(err);
      });
  };

  handleFileChange = (event)=>{
    this.setState({attachments:Array.from(event.target.files)});
  }

  handleRemoveFile =(index)=>{
    const updatedFiles =[...this.state.attachments];
    updatedFiles.splice(index,1);
    this.setState({attachments:updatedFiles});
  }
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
            <h2>Incident Information</h2>

            <label htmlFor="incident-date">Incident Date / تاريخ الحادث</label>
            <input type="date" id="incident-date" name="incident_date" required />

            <label htmlFor="incident-location">Incident Location / مكان الحادث:</label>
            <input type="text" id="incident-location" name="location" required />

            <label htmlFor="incident-time">Incident Time / وقت الحادث:</label>
            <input type="time" id="incident-time" name="incident_time" required />

            <h2>Affected Individuals</h2>

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
                <input type="text" id="patient-name" name="patient_name" />

                <label htmlFor="mrn">MRN / الرقم الطبى:</label>
                <input type="text" id="mrn" name="mrn" />
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
                <input type="text" id="employee-name" name="employee_name" />
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
                <input type="text" id="visitor-name" name="visitor_name" />
              </div>
            )}

            <h2>Incident Description</h2>
            <textarea
              id="incident-description"
              name="description"
              rows="4"
              placeholder="Describe the incident here"
              required
            ></textarea>

            <h2>Immediate Action Taken</h2>
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

            <label htmlFor="report-time">Date and Time / التاريخ و الوقت:</label>
            <input type="datetime-local" id="report-time" name="report_time" required />
            

            <label htmlFor="attachment"> Attach a copy of related documents (if any) <br/> (ان وجدت) ارفق نسخه من المتعلقات</label>
            <input 
              type="file" 
              id="attachment" 
              name="attachments" 
              multiple 
              onChange={this.handleFileChange}
            />
            <ul>
              {this.state.attachments.map((file,index)=>(
                <li key ={index}>
                  {file.name}
                  <button
                  type= 'button'
                  onClick={()=>this.handleRemoveFile(index)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button type="remove">Submit</button>
          </form>
        </div>
      </div>
    );
  }
}