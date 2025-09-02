import React,{ Component } from "react";
import { useLocation } from "react-router-dom";
import "./Settings.css";

export default class Settings extends Component {
  render() {
    return (
      <div className="settings-dashboard">
            <table id="incidentTable">
            <thead>
              <tr>
                <th>UserID</th>
                <th>Name</th>
                <th>Department</th>

              </tr>
            </thead>
            <tbody>
             
            </tbody>
          </table>
          
      </div>
    );
  }
}
