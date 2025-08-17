const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.use(express.static(path.join(__dirname, "build")));

// --------------------------------------------- incident-form-----------------------------------------------------------
app.post("/incident-form", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=incident_form;Trusted_Connection=Yes;"
    });

    const {
      reporter_name,
      reporter_title,
      report_time,
      incident_date,
      incident_time,
      location,
      description,
      immediate_action,
      patient,
      patient_name,
      mrn,
      employee,
      employee_name,
      visitor,
      visitor_name
    } = req.body;

    // Parse datetime-local string into separate date/time
    const reportDatetime = new Date(report_time);
    const reportDate = reportDatetime.toISOString().split("T")[0];
    const reportTimeOnly = reportDatetime.toTimeString().split(" ")[0];

    // Insert reporter and get ID
    let result = await pool
      .request()
      .input("Name", sql.NVarChar, reporter_name)
      .input("Title", sql.NVarChar, reporter_title)
      .input("ReportDate", sql.Date, reportDate)
      .input("ReportTime", sql.Time, reportTimeOnly)
      .query(`
        INSERT INTO Reporters (Name, Title, ReportDate, ReportTime)
        VALUES (@Name, @Title, @ReportDate, @ReportTime);
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const reporter_id = result.recordset[0].id;

    // Insert incident and get ID
    result = await pool
      .request()
      .input("ReporterID", sql.Int, reporter_id)
      .input("IncidentDate", sql.Date, incident_date)
      .input("IncidentTime", sql.Time, incident_time)
      .input("Location", sql.NVarChar, location)
      .input("Description", sql.NVarChar, description)
      .input("ImmediateAction", sql.NVarChar, immediate_action || null)
      .input("Attachments", sql.NVarChar, null)
      .query(`
        INSERT INTO Incidents (ReporterID, IncidentDate, IncidentTime, Location, Description, ImmediateAction, Attachments)
        VALUES (@ReporterID, @IncidentDate, @IncidentTime, @Location, @Description, @ImmediateAction, @Attachments);
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const incident_id = result.recordset[0].id;

    // Insert affected individuals
    if (patient && patient_name && mrn) {
      await pool
        .request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, patient_name)
        .input("MRN", sql.NVarChar, mrn)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, mrn)
          VALUES (@IncidentID, 'Patient', @Name, @MRN)
        `);
    }

    if (employee && employee_name) {
      await pool
        .request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, employee_name)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, mrn)
          VALUES (@IncidentID, 'Staff', @Name, NULL)
        `);
    }

    if (visitor && visitor_name) {
      await pool
        .request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, visitor_name)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, mrn)
          VALUES (@IncidentID, 'Visitor', @Name, NULL)
        `);
    }

    res.json({ status: "success", message: "Incident report submitted successfully." });
  } catch (error) {
    console.error("Error handling incident form:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

// ------------------------------------------- UPDATE INCIDEN
// T FOR QUALITY -------------------------------------------

app.get("/quality", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=incident_form;Trusted_Connection=Yes;"
    });

    const query = `
      SELECT 
        i.IncidentID,
        i.IncidentDate,
        i.Location,
        r.Name AS ReporterName,
        r.Title AS ReporterTitle,
        r.ReportDate,
        r.ReportTime,
        i.Description,
        i.status,
        i.responded,
        i.ImmediateAction,
        STRING_AGG(ai.Type + ': ' + COALESCE(ai.Name, ''), ', ') AS AffectedList
      FROM Incidents i
      JOIN Reporters r ON i.ReporterID = r.ReporterID
      LEFT JOIN AffectedIndividuals ai ON i.IncidentID = ai.IncidentID
      GROUP BY 
        i.IncidentID, 
        i.IncidentDate, 
        i.Location, 
        r.Name, 
        r.Title, 
        r.ReportDate, 
        r.ReportTime,
        i.Description, 
        i.ImmediateAction,
        i.status,
        i.responded
      ORDER BY i.IncidentID DESC
    `;


    const result = await pool.request().query(query);

    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});


// ====================== UPDATE INCIDENT (store DepartmentID) ======================
app.put("/quality", async (req, res) => {
  const { incidentId, departmentId } = req.body;

  if (!incidentId || !departmentId) {
    return res.status(400).json({ status: "error", message: "IncidentID and DepartmentID are required" });
  }

  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=incident_form;Trusted_Connection=Yes;"
    });

    await pool.request()
      .input("incidentId", sql.Int, incidentId)
      .input("departmentId", sql.Int, departmentId)
      .query(`
        UPDATE Incidents
        SET DepartmentID = @departmentId
        WHERE IncidentID = @incidentId
      `);

    res.json({ status: "success", message: "Department assigned successfully" });
  } catch (error) {
    console.error("Error assigning department:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//------------------------------------------------------------Departments------------------------------------------------------------

app.get("/departments", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=incident_form;Trusted_Connection=Yes;"
    });

    const result = await pool.request().query(`
      SELECT DepartmentID, DepartmentName
      FROM Departments
      ORDER BY DepartmentName
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});



// ====================== GET DEPARTMENTS (for dropdown) ======================
app.get("/departments", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=incident_form;Trusted_Connection=Yes;"
    });

    const result = await pool.request().query(`
      SELECT DepartmentID, DepartmentName 
      FROM Departments
      ORDER BY DepartmentName
    `);

    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//----------------------------------------------- GET incidents for a specific department-------------------------------------------

app.get("/departments/:departmentId", async (req, res) => {
  const { departmentId } = req.params;
  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=incident_form;Trusted_Connection=Yes;"
    });

    const result = await pool.request()
      .input("departmentId", sql.Int, departmentId)
      .query(`
        SELECT i.IncidentID AS number, i.IncidentDate AS date, i.Location AS location,
               r.Name AS reporter, i.Status AS status, i.Responded AS responded
        FROM Incidents i
        JOIN Reporters r ON i.ReporterID = r.ReporterID
        WHERE i.DepartmentID = @departmentId
        ORDER BY i.IncidentDate DESC
      `);

    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});


// ----------------------------------------- login -------------------------------------------------------
app.post("/login", async (req, res) => {
  const { UserID, Password } = req.body;

  if (!UserID || !Password) {
    return res.status(400).json({ status: "error", message: "UserID and Password are required" });
  }

  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=incident_form;Trusted_Connection=Yes;"
    });

    // Get the user and department in one query
    const result = await pool.request()
      .input("UserID", sql.Int, UserID)
      .query(`
        SELECT u.UserID, u.UserName, u.Password, d.DepartmentID, d.DepartmentName
        FROM Users u
        JOIN Departments d ON u.DepartmentID = d.DepartmentID
        WHERE u.UserID = @UserID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ status: "error", message: "UserID not found" });
    }

    const user = result.recordset[0];

    if (user.Password !== Password) {
      return res.status(401).json({ status: "error", message: "Incorrect password" });
    }

    // Send the department name to the frontend for redirect
    res.json({
      status: "success",
      message: "Login successful",
      department: user.DepartmentName
    });

  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});



//-------------------------------------------------------

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});