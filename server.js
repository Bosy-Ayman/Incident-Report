const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");

const app = express();
const port = 3000;

const dbConfig = {
  connectionString:
    "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=IncidentssReport;Trusted_Connection=Yes;",
};

module.exports = { sql, dbConfig };
app.use(cors());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.use(express.static(path.join(__dirname, "build")));

// --------------------------------------------- incident-form-----------------------------------------------------------
app.post("/incident-form", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

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

// ------------------------------------------- UPDATE INCIDENT FOR QUALITY -------------------------------------------

app.get("/quality", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

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
          i.Attachments,
          i.ImmediateAction,
          STRING_AGG(ai.Name, ', ') AS AffectedIndividualsNames,  
          STRING_AGG(ai.Type + ': ' + ai.Name, ', ') AS AffectedList  
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
          i.responded,
          i.Attachments
      ORDER BY i.IncidentID DESC;

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
    pool = await sql.connect(dbConfig);

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

//------------------------------------------ All Departments -------------------------------------------

app.get("/departments", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

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

//------------------------------ GET incidents for a specific department-------------------------------
app.get("/departments/:departmentId", async (req, res) => {
  const { departmentId } = req.params;
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const result = await pool.request()
      .input("departmentId", sql.Int, departmentId)
      .query(`
          SELECT 
              i.IncidentID,
              i.IncidentDate,
              i.IncidentTime,
              i.Location,
              r.Name AS ReporterName,
              r.Title AS ReporterTitle,
              r.ReportDate,
              r.ReportTime,
              i.Description,
              i.ImmediateAction,
              i.Attachments,
              i.status,
              i.responded,
              d.DepartmentName,
              STRING_AGG(ai.Type + ': ' + ai.Name, ', ') AS AffectedList
          FROM Incidents i
          JOIN Reporters r ON i.ReporterID = r.ReporterID
          LEFT JOIN Departments d ON i.DepartmentID = d.DepartmentID
          LEFT JOIN AffectedIndividuals ai ON i.IncidentID = ai.IncidentID
          WHERE i.DepartmentID = @departmentId
          GROUP BY 
              i.IncidentID,
              i.IncidentDate,
              i.IncidentTime,
              i.Location,
              r.Name,
              r.Title,
              r.ReportDate,
              r.ReportTime,
              i.Description,
              i.ImmediateAction,
              i.Attachments,
              i.status,
              i.responded,
              d.DepartmentName
          ORDER BY i.IncidentID DESC
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
    return res.status(400).json({
      status: "error",
      message: "UserID and Password are required",
    });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const result = await pool
      .request()
      .input("UserID", sql.Int, UserID)
      .query(`
        SELECT u.UserID, u.UserName, u.Password,
               d.DepartmentID, d.DepartmentName
        FROM Users u
        LEFT JOIN Departments d ON u.DepartmentID = d.DepartmentID
        WHERE u.UserID = @UserID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "UserID not found",
      });
    }

    const user = result.recordset[0];

    if (user.Password !== Password) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect password",
      });
    }


    return res.json({
      status: "success",
      message: "Login successful",
      userId: user.UserID,
      userName: user.UserName,
      departmentId: user.DepartmentID,
      departmentName: user.DepartmentName,
    });

  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  } finally {
    if (pool) await pool.close();
  }
});


//-----------------------------   Get  Department Response ------------------------

app.get('/department-response', async (req, res) => {
  const { UserID } = req.query; 

  if (!UserID) {
    return res.status(400).json({ error: "UserID is required" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool
      .request()
      .input("UserID", sql.Int, UserID)
      .query(`
          SELECT u.UserID, u.UserName,  
                d.ResponseID, d.IncidentID,d.DepartmentName, d.DepartmentID, d.Reason, 
                d.CorrectiveAction, d.ResponseDate, d.ResponseTime, d.Version
          FROM Users u
          JOIN DepartmentResponse d ON u.DepartmentID = d.DepartmentID
          WHERE u.UserID = @UserID

      `);

    res.json(result.recordset); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (pool) pool.close();
  }
});

// ------------------- UPDATE Department Response -------------------

app.put("/department-response", async (req, res) => {
  const { ResponseID, IncidentID, DepartmentID, Reason, CorrectiveAction, ResponseDate } = req.body;

  if (!IncidentID || !DepartmentID) {
    return res.status(400).json({ status: "error", message: "IncidentID and DepartmentID are required" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    if (ResponseID) {
      // UPDATE existing response
      await pool.request()
        .input("ResponseID", sql.Int, ResponseID)
        .input("Reason", sql.NVarChar, Reason)
        .input("CorrectiveAction", sql.NVarChar, CorrectiveAction)
        .input("ResponseDate", sql.Date, ResponseDate || null)
        .query(`
          UPDATE DepartmentResponse
          SET Reason = @Reason,
              CorrectiveAction = @CorrectiveAction,
              ResponseDate = @ResponseDate
          WHERE ResponseID = @ResponseID
        `);
      res.json({ status: "success", message: "Response updated successfully" });
    } else {
      // INSERT new response
      const result = await pool.request()
        .input("IncidentID", sql.Int, IncidentID)
        .input("DepartmentID", sql.Int, DepartmentID)
        .input("Reason", sql.NVarChar, Reason)
        .input("CorrectiveAction", sql.NVarChar, CorrectiveAction)
        .input("ResponseDate", sql.Date, ResponseDate || null)
        .query(`
          INSERT INTO DepartmentResponse (IncidentID, DepartmentID, Reason, CorrectiveAction, ResponseDate)
          VALUES (@IncidentID, @DepartmentID, @Reason, @CorrectiveAction, @ResponseDate);
          SELECT SCOPE_IDENTITY() AS ResponseID;
        `);

      const newResponseID = result.recordset[0].ResponseID;
      res.json({ status: "success", message: "Response created successfully", ResponseID: newResponseID });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// ------------------------ UPDATE Department Response --------------------------

app.post("/responses", async (req, res) => {
  const { incidentId, departmentId, reason, correctiveAction } = req.body;
  
  try {
    pool = await sql.connect(dbConfig);
    await pool.request()
      .input("IncidentID", sql.Int, incidentId)
      .input("DepartmentID", sql.Int, departmentId)
      .input("Reason", sql.Text, reason)
      .input("CorrectiveAction", sql.Text, correctiveAction)
      .input("ResponseDate", sql.Date, new Date())
      .input("ResponseTime", sql.Time, new Date())
      .input("Version", sql.Int, 1)
      .query(`
        INSERT INTO DepartmentResponse 
          (IncidentID, DepartmentID, Reason, CorrectiveAction, ResponseDate, ResponseTime, Version)
        VALUES (@IncidentID, @DepartmentID, @Reason, @CorrectiveAction, @ResponseDate, @ResponseTime, @Version)
      `);

    res.status(200).json({ message: "Response saved successfully" });
  } catch (err) {
    console.error("Error inserting response:", err);
    res.status(500).json({ error: "Failed to save response" });
  }
});
//------------------------------------------------------------------------
app.get("/quality/responses", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT dr.ResponseID, dr.IncidentID, dr.Reason, dr.CorrectiveAction, 
             dr.ResponseDate, dr.ResponseTime, dr.Version,
             d.DepartmentName, i.Description AS IncidentDescription
      FROM DepartmentResponse dr
      JOIN Departments d ON dr.DepartmentID = d.DepartmentID
      JOIN Incidents i ON dr.IncidentID = i.IncidentID
    `);

    res.json({ status: "success", data: result.recordset });
  } catch (err) {
    console.error("Error fetching responses:", err);
    res.status(500).json({ error: "Failed to fetch responses" });
  } finally {
    if (pool) await pool.close();
  }
});
//---------------------------------Recieving Quality Feedback After Implementation-----------------------------------

app.post("/quality/feedback", async (req, res) => {
  const { incidentId, categorization, } = req.body;
  
  try {
    pool = await sql.connect(dbConfig);
    await pool.request()
      .input("IncidentID", sql.Int, incidentId)
      .input("DepartmentID", sql.Int, departmentId)
      .input("Reason", sql.Text, reason)
      .input("CorrectiveAction", sql.Text, correctiveAction)
      .input("ResponseDate", sql.Date, new Date())
      .input("ResponseTime", sql.Time, new Date())
      .input("Version", sql.Int, 1)
      .query(`
        INSERT INTO DepartmentResponse 
          (IncidentID, DepartmentID, Reason, CorrectiveAction, ResponseDate, ResponseTime, Version)
        VALUES (@IncidentID, @DepartmentID, @Reason, @CorrectiveAction, @ResponseDate, @ResponseTime, @Version)
      `);

    res.status(200).json({ message: "Response saved successfully" });
  } catch (err) {
    console.error("Error inserting response:", err);
    res.status(500).json({ error: "Failed to save response" });
  }
});



//-----------------------------------------------------------------------------------

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});