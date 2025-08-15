const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());

// Middleware to parse form data & JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve React build folder as static files
app.use(express.static(path.join(__dirname, "build")));

// --------------------------------------------- incident-form-----------------------------------------------------------
app.post("/incident-form", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=NewIncident;Trusted_Connection=Yes;"
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

// -------------------------------------- UPDATE INCIDENT FOR QUALITY --------------------------------------
app.put("/quality", async (req, res) => {
  const {
    incidentId,
    departmentId,
    categorization,
    type,
    riskScoring,
    effectiveness,
    comment
  } = req.body;

  if (!incidentId) {
    return res.status(400).json({ status: "error", message: "IncidentID is required" });
  }

  let pool;
  try {
    pool = await sql.connect({
      connectionString:
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=NewIncident;Trusted_Connection=Yes;"
    });

    // Update incident with optional fields
    const query = `
      UPDATE Incidents
      SET 
        DepartmentID = COALESCE(@DepartmentID, DepartmentID),
        categorization = COALESCE(@Categorization, categorization),
        type = COALESCE(@Type, type),
        riskScoring = COALESCE(@RiskScoring, riskScoring),
        effectiveness = COALESCE(@Effectiveness, effectiveness),
        comment = COALESCE(@Comment, comment),
        status = 'Assigned'
      WHERE IncidentID = @IncidentID
    `;

    await pool.request()
      .input("IncidentID", sql.Int, incidentId)
      .input("DepartmentID", sql.Int, departmentId || null)
      .input("Categorization", sql.NVarChar, categorization || null)
      .input("Type", sql.NVarChar, type || null)
      .input("RiskScoring", sql.NVarChar, riskScoring || null)
      .input("Effectiveness", sql.NVarChar, effectiveness || null)
      .input("Comment", sql.NVarChar, comment || null)
      .query(query);

    res.json({ status: "success", message: "Incident updated successfully!" });
  } catch (error) {
    console.error("Error updating incident:", error);
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
        "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=NewIncident;Trusted_Connection=Yes;"
    });

    const userCheck = await pool.request()
      .input("UserID", sql.Int, UserID)
      .query(`SELECT UserID, Password FROM Users WHERE UserID = @UserID`);
    
    const redirect = await pool.request()
    .input("UserID", sql.Int, UserID)
    .query(`SELECT f FROM Users WHERE UserID = @UserID`);
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ status: "error", message: "UserID not found" });
    }

    const user = userCheck.recordset[0];
    if (user.Password !== Password) {
      return res.status(401).json({ status: "error", message: "Incorrect password" });
    }

    res.json({ status: "success", message: "Login successful" });

  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

