<p align="center">
</p>
<p align="center"><h1 align="center">INCIDENT-REPORT</h1></p>

<p align="center">
	<img src="https://img.shields.io/github/license/Bosy-Ayman/Incident-Report?style=default&logo=opensourceinitiative&logoColor=white&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/Bosy-Ayman/Incident-Report?style=default&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/Bosy-Ayman/Incident-Report?style=default&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/Bosy-Ayman/Incident-Report?style=default&color=0080ff" alt="repo-language-count">
</p>
<p align="center"><!-- default option, no dependency badges. -->
</p>
<p align="center">
	<!-- default option, no dependency badges. -->
</p>
<br>

##  Table of Contents

- [ Overview](#-overview)
- [ Features](#-features)
- [ Project Structure](#-project-structure)
  - [ Project Index](#-project-index)
- [ Getting Started](#-getting-started)
  - [ Prerequisites](#-prerequisites)
  - [ Installation](#-installation)
  - [ Usage](#-usage)
  - [ Testing](#-testing)

---

##  Overview

The aim was to implement a complete workflow that guided incidents from the moment they were reported until they were fully resolved


##  Features

**Incident Submission:** Users could log incidents directly with the quality department.

**Departmental Forwarding:** Quality staff could forward incidents to the relevant department.

**Departmental Response:** Departments received the incident, investigated it, and submitted causes, preventive actions, and a resolution due date.

**Quality Feedback:** The quality team reviewed these responses, provided feedback, and could also extend the deadline if a department had not yet responded.

**Quality Manager Review:** A final review step by the quality manager ensured accountability and closure.

**Administrator Role:** Administrators had the ability to add and update user accounts as well as manage departments.

**Designing an analytics dashboard to help visualize performance and trends. The dashboard included:**
--
A bar chart showing incidents by status (assigned, pending, resolved).

A pie chart showing who was affected (patients, visitors, employees).

A pie chart comparing responded versus pending incidents.

A bar chart of the average resolution time per department.
# ERD Diagram
<img width="1390" height="559" alt="image" src="https://github.com/user-attachments/assets/da989359-0d49-4ec8-870a-361b2674fc3a" />

---

##  Project Structure

```sh
└── Incident-Report/
    ├── README.md
    ├── netlify.toml
    ├── package-lock.json
    ├── package.json
    ├── public
    │   ├── alnas-hospital.png
    │   ├── favicon.ico
    │   ├── index.html
    │   ├── logout.jpg
    │   ├── manifest.json
    │   └── robots.txt
    ├── server.js
    └── src
        ├── App.css
        ├── App.js
        ├── App.test.js
        ├── components
        ├── index.js
        ├── pages
        ├── reportWebVitals.js
        └── setupTests.js
```



##  Getting Started

###  Prerequisites

Before getting started with Incident-Report, ensure your runtime environment meets the following requirements:

- **Programming Language:** CSS
- **Package Manager:** Npm


###  Installation

Install Incident-Report using one of the following methods:

**Build from source:**

1. Clone the Incident-Report repository:
```sh
❯ git clone https://github.com/Bosy-Ayman/Incident-Report
```

2. Navigate to the project directory:
```sh
❯ cd Incident-Report
```


---

