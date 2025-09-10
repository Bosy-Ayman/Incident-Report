import React, { Component } from "react";
import "./ITDepartment.css";
import "../components/Loading.css";

export default class ITDepartment extends Component {
  constructor(props) {
    
    super(props);
    this.state = {
      showDetailsModal: false,
      showAddModal: false,
      selectedUser: null,
      users: [],
      searchTerm: "",
      loading: true,
      error: null,
      newUser: {
        UserName: "",
        Password: "",
        confirmPassword: "",
        PhoneNumber: "",
        Email: "",
        DepartmentID: "",
        IsBlocked: "",


      }
    };
  }

  async componentDidMount() {
    await this.fetchUsers();
  }
  fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");

      const UsersRes = await fetch("/users", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include"
      });

      const UsersData = await UsersRes.json();
      const UsersArray = Array.isArray(UsersData.data) ? UsersData.data : [];

      this.setState({ users: UsersArray, loading: false, error: null });
    } catch (error) {
      console.error("Error fetching users:", error);
      this.setState({ error, loading: false });
    }
  };


  updateUser = async (userData) => {
    try {
      const token = localStorage.getItem("token");
      
      const response = await fetch("/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify(userData)
      });

      const result = await response.json();
      
      if (result.status === "success") {
        alert("User updated successfully!");
        await this.fetchUsers(); // Refresh the users list
        return true;
      } else {
        alert(`Error: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      this.setState({ error, loading: false });
    
    }
  };

  addUser = async (userData) => {
    try {
      const token = localStorage.getItem("token");
      
      const response = await fetch("/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify(userData)
      });

      const result = await response.json();
      
      if (result.status === "success") {
        alert("User added successfully!");
        await this.fetchUsers(); 
        return true;
      } else {
        alert(`Error: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Error adding user");
      return false;
    }
  };

  deleteUser = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      
      const response = await fetch(`/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        },
        credentials: "include"
      });

      const result = await response.json();
      
      if (result.status === "success") {
        alert("User deleted successfully!");
        await this.fetchUsers(); // Refresh the users list
        return true;
      } else {
        alert(`Error: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Error deleting user");
      return false;
    }
  };

  // Filter users based on search term
  getFilteredUsers = () => {
    const { users, searchTerm } = this.state;
    
    if (!searchTerm.trim()) {
      return users;
    }

    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    
    return users.filter(user => {
      const userIdMatch = user.UserID && user.UserID.toString().toLowerCase().includes(lowerSearchTerm);
      const userNameMatch = user.UserName && user.UserName.toLowerCase().includes(lowerSearchTerm);
      const departmentMatch = user.DepartmentName && user.DepartmentName.toLowerCase().includes(lowerSearchTerm);
      
      return userIdMatch || userNameMatch || departmentMatch;
    });
  };

  // Handle search input change
  handleSearchChange = (e) => {
    this.setState({ searchTerm: e.target.value });
  };

  openDetailsModal = (user) => {
    this.setState({
      showDetailsModal: true,
      selectedUser: { ...user, newPassword: "", confirmPassword: "" }
    });
  };

  closeDetailsModal = () => {
    this.setState({
      showDetailsModal: false,
      selectedUser: null
    });
  };

  closeAddModal = () => {
    this.setState({
      showAddModal: false,
      newUser: {
        UserName: "",
        Password: "",
        confirmPassword: "",
        PhoneNumber: "",
        Email: "",
        DepartmentID: "",
      }
    });
  };

  handleSaveUser = async () => {
    const { selectedUser } = this.state;
    
    // Validate passwords if they were entered
    if (selectedUser.newPassword || selectedUser.confirmPassword) {
      if (selectedUser.newPassword !== selectedUser.confirmPassword) {
        alert("Passwords do not match!");
        return;
      }
      if (selectedUser.newPassword.length < 6) {
        alert("Password must be at least 6 characters long!");
        return;
      }
    }

    // Prepare data for API
    const updateData = {
      UserID: selectedUser.UserID,
      UserName: selectedUser.UserName,
      PhoneNumber: selectedUser.PhoneNumber,
      Email: selectedUser.Email,
      DepartmentID: selectedUser.DepartmentID,
      IsBlocked: selectedUser.IsBlocked
    };

    // Only include password if it was changed
    if (selectedUser.newPassword) {
      updateData.Password = selectedUser.newPassword;
    }

    const success = await this.updateUser(updateData);
    if (success) {
      this.closeDetailsModal();
    }
  };

  handleDeleteUser = async () => {
    const { selectedUser } = this.state;
    
    if (!selectedUser || !selectedUser.UserID) {
      alert("No user selected for deletion!");
      return;
    }

    // Confirm deletion
    const confirmDelete = window.confirm(
      `Are you sure you want to delete user "${selectedUser.UserName}"? This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    const success = await this.deleteUser(selectedUser.UserID);
    if (success) {
      this.closeDetailsModal();
    }
  };

  render() {
    const { showDetailsModal,loading, error, selectedUser, searchTerm } = this.state;
    const filteredUsers = this.getFilteredUsers();

  if (loading) {
    return (
      <div 
        className="protected-container" 
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <div className="loader"></div>
      </div>
    );
  }

  if (error) {
    return <div>Error loading users: {error.message}</div>;
  }
    return (
      <div className="settings-dashboard">
        
        <div className="search-bar">
          <input 
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={this.handleSearchChange}
          />
        </div>

        {/* Users Table */}
        <table id="incidentTable">
          <thead>
            <tr>
              <th>UserID</th>
              <th>Name</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Email</th>
               <th>Is Blocked</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.UserID}>
                  <td>{user.UserID}</td>
                  <td>{user.UserName}</td>
                  <td>{user.DepartmentName}</td>
                  <td>{user.PhoneNumber}</td>
                  <td>{user.Email}</td>
                  <td className ={user.IsBlocked== true ?'status-blocked':'status-unblocked'}>{user.IsBlocked== true ?'Blocked':'UnBlocked'}</td>
                  <td>
                    <button
                      className="details-btn"
                      onClick={() => this.openDetailsModal(user)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                  {searchTerm ? 'No users found matching your search.' : 'No users available.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Edit User Modal */}
        {showDetailsModal && selectedUser && (
          <div className="modal-bg active" onClick={this.closeDetailsModal}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >

            <button
              className="close-btn"
              onClick={this.closeDetailsModal}
              aria-h4="Close details modal"
            >
              ×
            </button>

              <h3>Edit User Information</h3>

              <h4>UserName</h4>
              <input
                type="text"
                value={selectedUser.UserName || ""}
                onChange={(e) => {
                  const updatedUser = { ...selectedUser, UserName: e.target.value };
                  this.setState({ selectedUser: updatedUser });
                }}
              />

              <h4>Phone Number</h4>
              <input
                type="text"
                value={selectedUser.PhoneNumber || ""}
                onChange={(e) => {
                  const updatedUser = { ...selectedUser, PhoneNumber: e.target.value };
                  this.setState({ selectedUser: updatedUser });
                }}
              />

              <h4>Email</h4>
              <input
                type="email"
                value={selectedUser.Email || ""}
                onChange={(e) => {
                  const updatedUser = { ...selectedUser, Email: e.target.value };
                  this.setState({ selectedUser: updatedUser });
                }}
              />

              <h4> New Password </h4>
              <input
                type="password"
                value={selectedUser.newPassword || ""}
                onChange={(e) => {
                  const updatedUser = { ...selectedUser, newPassword: e.target.value };
                  this.setState({ selectedUser: updatedUser });
                }}
              />

              <h4>Confirm Password</h4>
              <input
                type="password"
                value={selectedUser.confirmPassword || ""}
                onChange={(e) => {
                  const updatedUser = { ...selectedUser, confirmPassword: e.target.value };
                  this.setState({ selectedUser: updatedUser });
                }}
              />

              <div className="modal-buttons">
                <button className="delete-btn" onClick={this.handleDeleteUser}>
                  Delete User
                </button>
                <button className="save-btn" onClick={this.handleSaveUser}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }
}