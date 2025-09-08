import React, { Component } from 'react';
import { Navigate } from 'react-router-dom';
import './AddUser.css';

export default class AddUser extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newUser: {
        UserName: '',
        Password: '',
        confirmPassword: '',
        PhoneNumber: '',
        Email: '',
        DepartmentID: '',
      },
      departments: [], // Initialize departments state
      isSubmitting: false,
      redirectToUsers: false,
      error: null, // For error handling
    };
  }

  // Fetch departments when component mounts
  componentDidMount() {
    this.fetchDepartments();
  }

  fetchDepartments = async () => {
    try {
      const response = await fetch('/departments', {
        method: 'GET',
        credentials: 'include', // Include session cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result && Array.isArray(result)) {
        this.setState({ departments: result });
      } else {
        throw new Error('Invalid department data');
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      this.setState({ error: 'Failed to load departments' });
    }
  };

  handleAddUser = async () => {
    const { newUser } = this.state;

    // Validation
    if (!newUser.UserName || !newUser.Email || !newUser.Password || !newUser.DepartmentID) {
      alert('Please fill in all required fields!');
      return;
    }

    if (!newUser.UserID) {
      alert("Please enter a UserID!");
      return;
    }

    if (newUser.UserID.length > 10) {
      alert("UserID cannot be longer than 10 characters!");
      return;
    }

    if (newUser.Password !== newUser.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (newUser.Password.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }

    // For NEW users, we need to include UserID in the request
    // but the backend should treat this as a CREATE operation
    const addData = {
      UserID: newUser.UserID,      // Include for new user creation
      UserName: newUser.UserName,
      Password: newUser.Password,
      PhoneNumber: newUser.PhoneNumber,
      Email: newUser.Email,
      DepartmentID: parseInt(newUser.DepartmentID),
      isNewUser: true  // Add flag to indicate this is a new user
    };

    this.setState({ isSubmitting: true });

    const success = await this.addUser(addData);
    if (success) {
      this.setState({ redirectToUsers: true });
    } else {
      this.setState({ isSubmitting: false });
    }
  };

  addUser = async (userData) => {
  try {
    const response = await fetch('/users', {
      method: 'POST',  // Change from PUT to POST
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', 
      body: JSON.stringify(userData),
    });

    const result = await response.json();

    if (result.status === 'success') {
      alert('User added successfully!');
      return true;
    } else {
      alert(`Error: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error('Error adding user:', error);
    alert('Network error occurred while adding user');
    return false;
  }
};
  handleInputChange = (field, value) => {
    this.setState({
      newUser: { ...this.state.newUser, [field]: value },
    });
  };

  handleCancel = () => {
    this.setState({ redirectToUsers: true });
  };

  render() {
    const { newUser, isSubmitting, redirectToUsers, departments, error } = this.state;

    if (redirectToUsers) {
      return <Navigate to="/it-department" replace />;
    }

    return (
      <div className="add-user-page">
        <div className="add-user-container">
          <h2>Add New User</h2>

          <form className="add-user-form" onSubmit={(e) => e.preventDefault()}>
              <div className="form-group">
              <label>UserID *</label>
              <input
                type="text"
                value={newUser.UserID}
                //need to check whether this UserID exist before or not

                onChange={(e) => this.handleInputChange('UserID', e.target.value)}
                placeholder="Enter UserID"
                required
              />
            </div>

            <div className="form-group">
              <label>UserName *</label>
              <input
                type="text"
                value={newUser.UserName} 
                onChange={(e) => this.handleInputChange('UserName', e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="text"
                value={newUser.PhoneNumber}
                onChange={(e) => this.handleInputChange('PhoneNumber', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={newUser.Email}
                onChange={(e) => this.handleInputChange('Email', e.target.value)}
                placeholder="Enter email address"
                required
              />
            </div>

            <div className="form-group">
              <label>Department *</label>
              <select
                value={newUser.DepartmentID}
                onChange={(e) => this.handleInputChange('DepartmentID', e.target.value)}
                required
              >
                <option value="">Select Department</option>
                {error ? (
                  <option value="" disabled>
                    Error loading departments
                  </option>
                ) : departments.length > 0 ? (
                  departments.map((dept) => (
                    <option key={dept.DepartmentID} value={dept.DepartmentID}>
                      {dept.DepartmentName}
                    </option>
                  ))
                ) : (
                   <div 
                    className="protected-container" 
                    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
                  >
                    <div className="loader"></div>
                  </div>
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                value={newUser.Password}
                onChange={(e) => this.handleInputChange('Password', e.target.value)}
                placeholder="Enter password (min 6 characters)"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <input
                type="password"
                value={newUser.confirmPassword}
                onChange={(e) => this.handleInputChange('confirmPassword', e.target.value)}
                placeholder="Confirm password"
                required
              />
            </div>

            <div className="form-buttons">
              <button
                type="button"
                className="cancel-btn"
                onClick={this.handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={this.handleAddUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding User...' : 'Add User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}