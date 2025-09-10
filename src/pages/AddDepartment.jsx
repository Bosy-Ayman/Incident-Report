import React, { Component } from 'react';
import './AddDepartment.css';

export default class AddDepartment extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newDepartment: {
        DepartmentName: '',
      },
      isSubmitting: false,
    };
  }

  handleInputChange = (e) => {
    const { value } = e.target;
    this.setState({
      newDepartment: { ...this.state.newDepartment, DepartmentName: value },
    });
  };

  addDepartment = async () => {
    this.setState({ isSubmitting: true });
    try {
      const response = await fetch('/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(this.state.newDepartment),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success') {
        alert('Department added successfully!');
        this.setState({
          newDepartment: { DepartmentName: '' },
          isSubmitting: false,
        });
        return true;
      } else {
        alert(`Error: ${result.message}`);
        this.setState({ isSubmitting: false });
        return false;
      }
    } catch (error) {
      console.error('Error adding department:', error);
      alert('Network error occurred while adding department');
      this.setState({ isSubmitting: false });
      return false;
    }
  };

  render() {
    const { newDepartment, isSubmitting } = this.state;

    return (
      <div className="add-department-page">
        <div className="add-department-container">
          <form className="add-department-form" onSubmit={(e) => {
            e.preventDefault();
            this.addDepartment();
          }}>
            <div className="form-group">
              <label>Department Name *</label>
              <input
                type="text"
                value={newDepartment.DepartmentName}
                onChange={this.handleInputChange}
                placeholder="Enter Department Name"
                required
              />
            </div>
            <div className="form-buttons">
              <button
                type="submit"
                className="save-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding Department...' : 'Add Department'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}