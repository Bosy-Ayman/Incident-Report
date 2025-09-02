const express = require("express");
const bodyParser = require("body-parser");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const app = express();
app.use(express.json()); 
const port = 3000;
const path = require("path");
const multer = require("multer");
const session = require("express-session");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "build")));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ------------------- SESSION SETUP -------------------
app.use(
  session({
    secret: "Secret123",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);
const dbConfig = {
  connectionString:
    "Driver={ODBC Driver 17 for SQL Server};Server=BOSY\\SQLEXPRESS;Database=InR;Trusted_Connection=Yes;",
};

module.exports = { sql, dbConfig };
// ------------------- MIDDLEWARE -------------------

function requireDepartmentAccess(req, res, next) {
  const requestedDept = parseInt(req.params.departmentId);
  const userDept = req.session.user.departmentId;

  if (requestedDept !== userDept) {
    return res.status(403).json({ status: "error", message: "Forbidden" });
  }
  next();
}
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }
  next();
}

function requireQualityDepartment(req, res, next) {
  if (req.session.user.departmentId !== 34) {
    return res.status(403).json({ status: "error", message: "Forbidden" });
  }
  next();
}

//------------------------------Handle adding attachments------- 
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const incidentId = req.body.IncidentID || "unknown";
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `file_${incidentId}_${timestamp}${ext}`);
  },
});

// Define upload using the storage
const upload = multer({ storage: storage });

// Route


// --------------------------------------------- incident-form-----------------------------------------------------------
// use multer to parse form-data with attachments
app.post("/incident-form", upload.array("attachment"), async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    // req.body now works with form-data
    const {
      reporter_name,
      reporter_title,
      report_time,
      incident_date,
      incident_time,
      location,
      description,
      immediate_action,
      patientChecked,
      patient_name,
      mrn,
      employeeChecked,
      employee_name,
      visitorChecked,
      visitor_name
    } = req.body;

    // get uploaded file names (comma separated string)
    const attachments = req.files && req.files.length > 0
      ? req.files.map(f => f.filename).join(",")
      : null;

    const reportDatetime = new Date(report_time);
    const reportDate = reportDatetime.toISOString().split("T")[0];
    const reportTimeOnly = reportDatetime.toTimeString().split(" ")[0];

    // Insert reporter
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

    // Insert incident (attachments included)
    result = await pool
      .request()
      .input("ReporterID", sql.Int, reporter_id)
      .input("IncidentDate", sql.Date, incident_date)
      .input("IncidentTime", sql.Time, incident_time)
      .input("Location", sql.NVarChar, location)
      .input("Description", sql.NVarChar, description)
      .input("ImmediateAction", sql.NVarChar, immediate_action || null)
      .input("Attachments", sql.NVarChar, attachments)
      .query(`
        INSERT INTO Incidents (ReporterID, IncidentDate, IncidentTime, Location, Description, ImmediateAction, Attachments)
        VALUES (@ReporterID, @IncidentDate, @IncidentTime, @Location, @Description, @ImmediateAction, @Attachments);
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const incident_id = result.recordset[0].id;

    // Insert affected individuals
    if (patientChecked && patient_name && mrn) {
      await pool.request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, patient_name)
        .input("MRN", sql.NVarChar, mrn)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, mrn)
          VALUES (@IncidentID, 'Patient', @Name, @MRN)
        `);
    }

    if (employeeChecked && employee_name) {
      await pool.request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, employee_name)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, mrn)
          VALUES (@IncidentID, 'Staff', @Name, NULL)
        `);
    }

    if (visitorChecked && visitor_name) {
      await pool.request()
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

app.get("/quality" ,requireLogin, requireQualityDepartment, async (req, res) => {
  console.log("Quality endpoint hit, user:", req.session.user);
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const query = `
      WITH IncidentBase AS (
        SELECT DISTINCT
            i.IncidentID,
            i.IncidentDate,
            i.IncidentTime,
            i.Location,
            r.Name AS ReporterName,
            r.Title AS ReporterTitle,
            r.ReportDate,
            r.ReportTime,
            i.Description AS IncidentDescription,
            i.status,
            i.responded,
            i.Attachments,
            i.DepartmentID,
            i.ImmediateAction,
            d.DepartmentName
        FROM Incidents i
        JOIN Reporters r ON i.ReporterID = r.ReporterID
        LEFT JOIN IncidentDepartments id ON i.IncidentID = id.IncidentID
        LEFT JOIN Departments d ON id.DepartmentID = d.DepartmentID
      ),
      QualityData AS (
        SELECT 
            q.IncidentID,
            q.ReviewedFlag,
            q.feedbackdate AS FeedbackDate,
            q.ReviewedDate,
            q.Type AS FeedbackType,
            q.Categorization AS FeedbackCategorization,
            q.RiskScoring AS FeedbackRiskScoring,
            q.EffectivenessResult AS FeedbackEffectiveness,
            q.QualityID,
            u.UserName AS QualitySpecialistName,
            CASE WHEN q.FeedbackFlag = 'true' THEN 1 ELSE 0 END AS FeedbackFlag,
            ROW_NUMBER() OVER (PARTITION BY q.IncidentID ORDER BY q.feedbackdate DESC) as rn
        FROM QualityReviews q
        LEFT JOIN Users u ON q.QualityID = u.UserID
      )
      SELECT 
          ib.*,
          COALESCE(qd.ReviewedFlag, 'false') AS ReviewedFlag,
          qd.FeedbackDate,
          qd.ReviewedDate,
          qd.FeedbackType,
          qd.FeedbackCategorization,
          qd.FeedbackRiskScoring,
          qd.FeedbackEffectiveness,
          qd.QualityID,
          qd.QualitySpecialistName,
          COALESCE(qd.FeedbackFlag, 0) AS FeedbackFlag,

          (
            SELECT dr.ResponseID, dr.Reason, dr.CorrectiveAction, dr.ResponseDate, dr.DueDate, d2.DepartmentName
            FROM DepartmentResponse dr
            LEFT JOIN Departments d2 ON dr.DepartmentID = d2.DepartmentID
            WHERE dr.IncidentID = ib.IncidentID
            FOR JSON PATH
          ) AS Responses,

          -- Affected individuals list
          STUFF((
            SELECT ', ' + ai2.Name
            FROM AffectedIndividuals ai2
            WHERE ai2.IncidentID = ib.IncidentID
            FOR XML PATH(''), TYPE
          ).value('.', 'NVarChar(MAX)'), 1, 2, '') AS AffectedIndividualsNames

      FROM IncidentBase ib
      LEFT JOIN QualityData qd ON ib.IncidentID = qd.IncidentID AND qd.rn = 1
      ORDER BY ib.IncidentID DESC;
    `;

    const result = await pool.request().query(query);

    console.log(`Query returned ${result.recordset.length} incidents`);
    
    // Additional deduplication on the Node.js side as a safety measure
    const uniqueIncidents = [];
    const seenIds = new Set();
    
    for (const incident of result.recordset) {
      if (!seenIds.has(incident.IncidentID)) {
        seenIds.add(incident.IncidentID);
        uniqueIncidents.push(incident);
      }
    }
    
    console.log(`After deduplication: ${uniqueIncidents.length} unique incidents`);

    res.json({ status: "success", data: uniqueIncidents });
  } catch (error) {
    console.error("Error fetching incidents:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//---------------------------------------Another func for fetching all assigned departments--------------
app.get("/assigned-departments",requireLogin, requireQualityDepartment, async (req, res) => {
  console.log("Fetching assigned departments, user:", req.session.user);
  let pool;

  try {
    pool = await sql.connect(dbConfig);

    const query = `
      SELECT 
          i.IncidentID,
          STRING_AGG(CAST(id.DepartmentID AS NVARCHAR(10)), ',') AS DepartmentIDs,
          COALESCE(STRING_AGG(d.DepartmentName, ', '), '') AS DepartmentNames
      FROM Incidents i
      LEFT JOIN IncidentDepartments id ON i.IncidentID = id.IncidentID
      LEFT JOIN Departments d ON id.DepartmentID = d.DepartmentID
      GROUP BY i.IncidentID
      ORDER BY i.IncidentID DESC;
    `;

    const result = await pool.request().query(query);

    res.json({ status: "success", data: result.recordset });

  } catch (error) {
    console.error("Error fetching assigned departments:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

// ====================== UPDATE INCIDENT (store DepartmentID) ======================

app.put("/quality", requireLogin, requireQualityDepartment, async (req, res) => {
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
        INSERT INTO IncidentDepartments (IncidentID, DepartmentID)
        VALUES (@incidentId, @departmentId);

        UPDATE Incidents
        SET status = 'Assigned' 
        WHERE IncidentID = @incidentId;
      `);

    res.json({ status: "success", message: "Department assigned and status updated to Assigned" });
  } catch (error) {
    console.error("Error assigning department:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//------------------------GET All Departments FOR Forwarding the incident-------------------------

app.get("/departments" ,async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT DepartmentID, DepartmentName
      FROM Departments
      WHERE DepartmentName IS NOT NULL
        AND DepartmentName NOT IN (N'Quality Management', N'Quality Mangement')
      ORDER BY DepartmentName
    `);
    console.log("Departments count:", result.recordset.length);
    res.json(result.recordset); // return a clean array
  } catch (err) {
    console.error("GET /departments error:", err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (pool) await pool.close();
  }
});


//----------------------------- Add/Update Department Response ------------------------
app.put("/department-response" , async (req, res) => {
  const { ResponseID, IncidentID, DepartmentID, Reason, CorrectiveAction, DueDate } = req.body;

  // Validate required fields
  if (!IncidentID || !DepartmentID) {
    return res.status(400).json({ status: "error", message: "IncidentID and DepartmentID are required" });
  }
  if (!Reason || !CorrectiveAction) {
    return res.status(400).json({ status: "error", message: "Reason and CorrectiveAction are required" });
  }
  if (DueDate && isNaN(Date.parse(DueDate))) {
    return res.status(400).json({ status: "error", message: "Invalid DueDate format" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Verify IncidentID exists
      const incidentCheck = await transaction.request()
        .input("IncidentID", sql.Int, IncidentID)
        .query("SELECT 1 FROM Incidents WHERE IncidentID = @IncidentID");
      if (incidentCheck.recordset.length === 0) {
        return res.status(400).json({ status: "error", message: "Invalid IncidentID" });
      }

      // Verify DepartmentID exists and get DepartmentName
      const deptCheck = await transaction.request()
        .input("DepartmentID", sql.Int, DepartmentID)
        .query("SELECT DepartmentName FROM Departments WHERE DepartmentID = @DepartmentID");
      if (deptCheck.recordset.length === 0) {
        return res.status(400).json({ status: "error", message: "Invalid DepartmentID" });
      }
      const departmentName = deptCheck.recordset[0].DepartmentName;

      // Verify IncidentID and DepartmentID are linked in IncidentDepartments
      const incidentDeptCheck = await transaction.request()
        .input("IncidentID", sql.Int, IncidentID)
        .input("DepartmentID", sql.Int, DepartmentID)
        .query("SELECT RespondedFlag FROM IncidentDepartments WHERE IncidentID = @IncidentID AND DepartmentID = @DepartmentID");
      if (incidentDeptCheck.recordset.length === 0) {
        return res.status(400).json({ status: "error", message: "Incident is not assigned to this department" });
      }

      const now = new Date();
      let responseIdResult;
      let responseData;

      if (ResponseID) {
        // Verify ResponseID exists
        const responseCheck = await transaction.request()
          .input("ResponseID", sql.Int, ResponseID)
          .input("DepartmentID", sql.Int, DepartmentID)
          .query("SELECT 1 FROM DepartmentResponse WHERE ResponseID = @ResponseID AND DepartmentID = @DepartmentID");
        if (responseCheck.recordset.length === 0) {
          return res.status(400).json({ status: "error", message: "Invalid ResponseID or DepartmentID for this response" });
        }

        // UPDATE existing response
        await transaction.request()
          .input("ResponseID", sql.Int, ResponseID)
          .input("DepartmentID", sql.Int, DepartmentID)
          .input("Reason", sql.NVarChar, Reason)
          .input("CorrectiveAction", sql.NVarChar, CorrectiveAction)
          .input("ResponseDate", sql.DateTime, now)
          .input("DueDate", sql.Date, DueDate || null)
          .query(`
            UPDATE DepartmentResponse
            SET Reason = @Reason,
                CorrectiveAction = @CorrectiveAction,
                ResponseDate = @ResponseDate,
                DueDate = @DueDate
            WHERE ResponseID = @ResponseID AND DepartmentID = @DepartmentID
          `);

        responseIdResult = ResponseID;
        responseData = {
          ResponseID: responseIdResult,
          IncidentID,
          DepartmentID,
          Reason,
          CorrectiveAction,
          ResponseDate: now.toISOString().split("T")[0],
          DueDate: DueDate || null,
          DepartmentName: departmentName
        };
      } else {
        // INSERT new response
        const result = await transaction.request()
          .input("IncidentID", sql.Int, IncidentID)
          .input("DepartmentID", sql.Int, DepartmentID)
          .input("Reason", sql.NVarChar, Reason)
          .input("CorrectiveAction", sql.NVarChar, CorrectiveAction)
          .input("ResponseDate", sql.DateTime, now)
          .input("DueDate", sql.Date, DueDate || null)
          .query(`
            INSERT INTO DepartmentResponse
              (IncidentID, DepartmentID, Reason, CorrectiveAction, ResponseDate, DueDate)
            VALUES (@IncidentID, @DepartmentID, @Reason, @CorrectiveAction, @ResponseDate, @DueDate);
            SELECT SCOPE_IDENTITY() AS ResponseID;
          `);

        responseIdResult = result.recordset[0].ResponseID;
        responseData = {
          ResponseID: responseIdResult,
          IncidentID,
          DepartmentID,
          Reason,
          CorrectiveAction,
          ResponseDate: now.toISOString().split("T")[0],
          DueDate: DueDate || null,
          DepartmentName: departmentName
        };
      }

      // Update RespondedFlag in IncidentDepartments
      await transaction.request()
        .input("IncidentID", sql.Int, IncidentID)
        .input("DepartmentID", sql.Int, DepartmentID)
        .query(`
          UPDATE IncidentDepartments
          SET RespondedFlag = 'true'
          WHERE IncidentID = @IncidentID AND DepartmentID = @DepartmentID
        `);

      // Update incident status to 'Pending' after department responds
      await transaction.request()
        .input("incidentId", sql.Int, IncidentID)
        .query(`
          UPDATE Incidents
          SET responded = 'Yes',
              status = 'Pending'
          WHERE IncidentID = @incidentId
        `);

      await transaction.commit();

      res.json({
        status: "success",
        message: ResponseID ? "Response updated successfully" : "Response saved successfully",
        ResponseID: responseIdResult,
        response: responseData
      });
    } catch (err) {
      await transaction.rollback();
      return res.status(400).json({ status: "error", message: err.message });
    }
  } catch (err) {
    console.error("Error saving department response:", err);
    res.status(500).json({ status: "error", message: "Server error: " + err.message });
  } finally {
    if (pool) await pool.close();
  }
});

//------------------ Insert Quality Feedback -----------------------------
app.post("/quality-feedback", requireLogin, requireQualityDepartment, async (req, res) => {
  const { incidentId, type, categorization, riskScoring, effectiveness} = req.body;

  if (!incidentId) {
    return res.status(400).json({ status: "error", message: "IncidentID is required" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const risk = riskScoring ? parseInt(riskScoring) : null;
    
    // Get user information from session
    const userId = req.session.user.id;
    
    console.log({ 
      incidentId, 
      type, 
      categorization, 
      risk, 
      effectiveness, 
      userId, 
    }); 

    // Check if feedback already exists for this incident
    const existingFeedback = await pool.request()
      .input("IncidentID", sql.Int, incidentId)
      .query(`
        SELECT * FROM QualityReviews 
        WHERE IncidentID = @IncidentID
      `);

    if (existingFeedback.recordset.length > 0) {
      // UPDATE existing feedback
      await pool.request()
        .input("IncidentID", sql.Int, incidentId)
        .input("Type", sql.NVarChar(255), type)
        .input("Categorization", sql.NVarChar(255), categorization)
        .input("RiskScoring", sql.Int, risk)
        .input("EffectivenessResult", sql.NVarChar(50), effectiveness)
        .input("QualityID", sql.Int, userId)
        .query(`
          UPDATE QualityReviews
          SET Type = @Type,
              Categorization = @Categorization,
              RiskScoring = @RiskScoring,
              EffectivenessResult = @EffectivenessResult,
              QualityID = @QualityID,
              FeedbackFlag = 'true'
          WHERE IncidentID = @IncidentID
        `);
    } else {
      // INSERT new feedback
      await pool.request()
        .input("IncidentID", sql.Int, incidentId)
        .input("Type", sql.NVarChar(255), type)
        .input("Categorization", sql.NVarChar(255), categorization)
        .input("RiskScoring", sql.Int, risk)
        .input("EffectivenessResult", sql.NVarChar(50), effectiveness)
        .input("QualityID", sql.Int, userId)
        .query(`
          INSERT INTO QualityReviews
          (IncidentID, Type, Categorization, RiskScoring, EffectivenessResult, QualityID, FeedbackFlag)
          VALUES
          (@IncidentID, @Type, @Categorization, @RiskScoring, @EffectivenessResult, @QualityID, 'true')
        `);
    }

    res.status(200).json({ status: "success", message: "Feedback saved successfully" });

  } catch (err) {
    console.error("Error saving quality feedback:", err.message, err);
    res.status(500).json({ status: "error", message: "Failed to save feedback", detail: err.message });
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
            i.status,
            i.responded,
            i.Attachments,
            i.DepartmentID,
            d.DepartmentName,
            id.RespondedFlag,
            -- Aggregate DepartmentResponse into JSON
            (SELECT 
                dr.ResponseID,
                dr.IncidentID,
                dr.DepartmentID,
                dr.Reason,
                dr.CorrectiveAction,
                dr.ResponseDate,
                dr.DueDate,
                d2.DepartmentName
             FROM DepartmentResponse dr
             LEFT JOIN Departments d2 ON dr.DepartmentID = d2.DepartmentID
             WHERE dr.IncidentID = i.IncidentID
             FOR JSON PATH) AS Responses,
            -- Quality Review fields
            q.Type AS FeedbackType,
            q.Categorization AS FeedbackCategorization,
            q.RiskScoring AS FeedbackRiskScoring,
            q.EffectivenessResult AS FeedbackEffectiveness,
            q.QualityID,
            u.UserName AS QualitySpecialistName,
            CASE WHEN q.FeedbackFlag = 'true' THEN 1 ELSE 0 END AS FeedbackFlag,
            CASE WHEN q.ReviewedFlag = 'true' THEN 1 ELSE 0 END AS ReviewedFlag,
            -- Affected individuals
            STUFF((
              SELECT ', ' + ai2.Name
              FROM AffectedIndividuals ai2
              WHERE ai2.IncidentID = i.IncidentID
              FOR XML PATH(''), TYPE
            ).value('.', 'NVarChar(MAX)'), 1, 2, '') AS AffectedIndividualsNames, 
            STUFF((
              SELECT ', ' + ai2.Type + ': ' + ai2.Name
              FROM AffectedIndividuals ai2
              WHERE ai2.IncidentID = i.IncidentID
              FOR XML PATH(''), TYPE
            ).value('.', 'NVarChar(MAX)'), 1, 2, '') AS AffectedList 
        FROM Incidents i
        JOIN Reporters r ON i.ReporterID = r.ReporterID
        JOIN IncidentDepartments id ON i.IncidentID = id.IncidentID
        LEFT JOIN Departments d ON id.DepartmentID = d.DepartmentID
        LEFT JOIN QualityReviews q ON q.IncidentID = i.IncidentID
        LEFT JOIN Users u ON q.QualityID = u.UserID
        WHERE id.DepartmentID = @departmentId
        ORDER BY i.IncidentID DESC;
      `);

    console.log(`Found ${result.recordset.length} incidents for department ${departmentId}`);
    
    // Debug: Log first few records
    if (result.recordset.length > 0) {
      console.log("Sample record:", {
        IncidentID: result.recordset[0].IncidentID,
        DepartmentName: result.recordset[0].DepartmentName,
        Responses: result.recordset[0].Responses,
        RespondedFlag: result.recordset[0].RespondedFlag
      });
    }

    // Deduplicate incidents to avoid multiple rows per IncidentID
    const uniqueIncidents = [];
    const seenIds = new Set();
    for (const incident of result.recordset) {
      if (!seenIds.has(incident.IncidentID)) {
        seenIds.add(incident.IncidentID);
        uniqueIncidents.push(incident);
      }
    }

    res.json({ status: "success", data: uniqueIncidents });
  } catch (err) {
    console.error("Error fetching department incidents:", err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

// -------------------------- Add this endpoint to your backend code-----------------------
app.get("/department-info/:departmentId", async (req, res) => {
  const { departmentId } = req.params;
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input("departmentId", sql.Int, departmentId)
      .query(`
        SELECT DepartmentID, DepartmentName
        FROM Departments
        WHERE DepartmentID = @departmentId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ status: "error", message: "Department not found" });
    }

    res.json({ status: "success", data: result.recordset[0] });
  } catch (err) {
    console.error("Error fetching department info:", err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (pool) await pool.close();
  }
});
// ----------------------------------------- login -------------------------------------
app.post("/login", async (req, res) => {
  const { UserID, Password } = req.body || {}; 

  if (!UserID || !Password) {
    return res.status(400).json({ status: "error", message: "UserID and Password required" });
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

    if (result.recordset.length === 0)
      return res.status(404).json({ status: "error", message: "UserID not found" });

    const user = result.recordset[0];
    if (user.Password !== Password)
      return res.status(401).json({ status: "error", message: "Incorrect password" });

    // Save user session
    req.session.user = {
      id: user.UserID,
      departmentId: user.DepartmentID,
      name: user.UserName,
    };

    return res.json({
      status: "success",
      message: "Login successful",
      userId: user.UserID,
      departmentId: user.DepartmentID,
      departmentName: user.DepartmentName,
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (pool) await pool.close();
  }
});
//------------------------------------Modify reviewed flag by the manager-------------
app.post("/review-incident", requireLogin, async (req, res) => {
  const { incidentId, reviewed } = req.body;
  console.log("Review endpoint hit, user:", req.session.user);
  console.log("Request body:", req.body);

  if (!incidentId) {
    return res.status(400).json({ status: "error", message: "Missing incident ID" });
  }

  // Check if user has permission (only user 1033 can mark as reviewed)
  if (req.session.user.id !== 1033) {
    return res.status(403).json({ status: "error", message: "Unauthorized to review incidents" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    // First check if QualityReviews record exists
    const existingReview = await pool.request()
      .input("incidentId", sql.Int, incidentId)
      .query(`
        SELECT * FROM QualityReviews 
        WHERE IncidentID = @incidentId
      `);

    const reviewedFlag = reviewed ? "true" : "false";
    const reviewedDate = reviewed ? new Date() : null;

    if (existingReview.recordset.length > 0) {
      // UPDATE existing record
      await pool.request()
        .input("incidentId", sql.Int, incidentId)
        .input("reviewed", sql.NVarChar, reviewedFlag)
        .input("reviewedDate", sql.DateTime, reviewedDate)
        .query(`
          UPDATE QualityReviews
          SET ReviewedFlag = @reviewed,
              ReviewedDate = @reviewedDate
          WHERE IncidentID = @incidentId
        `);
    } else {
      // INSERT new record
      await pool.request()
        .input("incidentId", sql.Int, incidentId)
        .input("reviewed", sql.NVarChar, reviewedFlag)
        .input("reviewedDate", sql.DateTime, reviewedDate)
        .input("qualityId", sql.Int, req.session.user.id)
        .query(`
          INSERT INTO QualityReviews (IncidentID, ReviewedFlag, ReviewedDate, QualityID)
          VALUES (@incidentId, @reviewed, @reviewedDate, @qualityId)
        `);
    }

    res.json({ status: "success", message: "Incident review updated" });
  } catch (err) {
    console.error("Error updating review:", err);
    res.status(500).json({ status: "error", message: "Database update failed" });
  } finally {
    if (pool) await pool.close();
  }
});


//--------------------------------------CLOSE INCIDENT -------------------------------
app.put("/quality/close-incident", requireLogin, requireQualityDepartment, async (req, res) => {
  const { IncidentID } = req.body; 
  if (!IncidentID) {
    return res.status(400).json({ status: "error", message: "Incident ID is required" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    await pool.request()
      .input("IncidentID",sql.Int, IncidentID)
      .query(`
        UPDATE Incidents
        SET status = 'Done'
        WHERE IncidentID = @IncidentID
      `);

    res.json({ status: "success", message: "Incident closed successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

//===============================DASHBOARD==========================================

//-----------------BarChart: Number of Incidents per Department---------------------
app.get("/incident-per-department", requireLogin, async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const query = `
      SELECT 
          d.DepartmentName,
          COALESCE(SUM(CASE WHEN i.status = 'Assigned' THEN 1 ELSE 0 END), 0) AS AssignedCount,
          COALESCE(SUM(CASE WHEN i.status = 'Pending' THEN 1 ELSE 0 END), 0) AS PendingCount,
          COALESCE(SUM(CASE WHEN i.status = 'Done' THEN 1 ELSE 0 END), 0) AS ClosedCount
      FROM Departments d
      LEFT JOIN IncidentDepartments id ON d.DepartmentID = id.DepartmentID
      LEFT JOIN Incidents i ON id.IncidentID = i.IncidentID
      WHERE d.DepartmentName IS NOT NULL
        AND d.DepartmentName NOT IN (N'Quality Management', N'Quality Mangement')
      GROUP BY d.DepartmentName
      ORDER BY d.DepartmentName;
    `;

    const result = await pool.request().query(query);
    console.log("Incident per department data:", result.recordset);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching incident-per-department:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//-------------------PieChart: Affected Individuals Type-------------------------
app.get("/affected-types", requireLogin, async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const query = `
      SELECT 
          ai.Type, 
          COUNT(*) AS Count
      FROM AffectedIndividuals ai
      GROUP BY ai.Type
      ORDER BY ai.Type;
    `;
    const result = await pool.request().query(query);
    console.log("Affected types data:", result.recordset);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching affected-types:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//-------------------LineChart: Incident Count per Day-------------------------
app.get("/incident-per-date", requireLogin, async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const query = `
      WITH Dates AS (
        SELECT DISTINCT IncidentDate
        FROM Incidents
      )
      SELECT 
          d.IncidentDate,
          COALESCE(SUM(CASE WHEN i.status = 'New' THEN 1 ELSE 0 END), 0) AS NewIncidentCount,
          COALESCE(SUM(CASE WHEN i.status = 'Assigned' THEN 1 ELSE 0 END), 0) AS AssignedIncidentCount,
          COALESCE(SUM(CASE WHEN i.status = 'Pending' THEN 1 ELSE 0 END), 0) AS PendingIncidentCount,
          COALESCE(SUM(CASE WHEN i.status = 'Done' THEN 1 ELSE 0 END), 0) AS ClosedIncidentCount
      FROM Dates d
      LEFT JOIN Incidents i ON i.IncidentDate = d.IncidentDate
      GROUP BY d.IncidentDate
      ORDER BY d.IncidentDate;
    `;

    const result = await pool.request().query(query);
    console.log("Incident per date data:", result.recordset);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching incident-per-date:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//-------------------PieChart: Responded or Not----------------------------
app.get("/if-responded", requireLogin, async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const query = `
      SELECT 
          CASE WHEN id.RespondedFlag = 'true' THEN 'Responded' ELSE 'Not Responded' END AS ResponseStatus,
          COUNT(*) AS Count
      FROM IncidentDepartments id
      GROUP BY id.RespondedFlag
      ORDER BY id.RespondedFlag;
    `;

    const result = await pool.request().query(query);
    console.log("If responded data:", result.recordset);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching if-responded:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});