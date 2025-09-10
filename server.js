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
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "build")));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
require("dotenv").config();

// ------------------- SESSION SETUP -------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

const dbConfig = {
  connectionString: process.env.DB_CONNECTION_STRING,
};

module.exports = { sql, dbConfig };
// ------------------- MIDDLEWARE -------------------

function requireDepartmentAccess(req, res, next) {
  const requestedDept = parseInt(req.params.departmentId);
  const userDept = req.session.user.departmentId;

  if (requestedDept !== userDept) {
    return res.status(403).json({ status: "error", message: "" });
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
  if (req.session.user.departmentId !== 34 && req.session.user.departmentId !== 39 ) {
    return res.status(403).json({ status: "error", message: "Forbidden" });
  }
  next();
}
//------------------------------Handle adding attachments------- 

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public", "uploads"));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `file_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// Route


// --------------------------------------------- incident-form-----------------------------------------------------------
app.post("/incident-form", upload.array("attachment"), async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    if (!req.body) {
      return res.status(400).json({ status: "error", message: "No form data received" });
    }

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
      visitor_name,
    } = req.body;

    // Required fields check
    if (!reporter_name || !reporter_title || !incident_date || !location || !description) {
      return res.status(400).json({ 
        status: "error", 
        message: "Missing required fields: reporter_name, reporter_title, incident_date, location, or description" 
      });
    }
    // Process report_time
    const reportDatetime = report_time ? new Date(report_time) : new Date();
    const reportDate = reportDatetime.toISOString().split("T")[0];
    const reportTimeOnly = reportDatetime.toTimeString().split(" ")[0];

    // Insert reporter
    let result = await pool.request()
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

    // Insert incident
    result = await pool.request()
      .input("ReporterID", sql.Int, reporter_id)
      .input("IncidentDate", sql.Date, incident_date)
      .input("IncidentTime", sql.Time, incident_time || null)
      .input("Location", sql.NVarChar, location)
      .input("Description", sql.NVarChar, description)
      .input("ImmediateAction", sql.NVarChar, immediate_action || null)
      .input("IncidentDateSubmitted", sql.DateTime, new Date())

      .query(`
        INSERT INTO Incidents (ReporterID, IncidentDate, IncidentTime, Location, Description, ImmediateAction, IncidentDateSubmitted)
        VALUES (@ReporterID, @IncidentDate, @IncidentTime, @Location, @Description, @ImmediateAction, @IncidentDateSubmitted);
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const incident_id = result.recordset[0].id;

    // Attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await pool.request()
          .input("Attachment", sql.NVarChar, file.filename)
          .input("IncidentID", sql.Int, incident_id)
          .query(`
            INSERT INTO Attachments (Attachment, IncidentID)
            VALUES (@Attachment, @IncidentID)
          `);
      }
    }

    // Affected Individuals
    if (patientChecked === 'true' && patient_name && mrn) {
      await pool.request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, patient_name)
        .input("MRN", sql.NVarChar, mrn)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, MRN)
          VALUES (@IncidentID, 'Patient', @Name, @MRN)
        `);
    }

    if (employeeChecked === 'true' && employee_name) {
      await pool.request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, employee_name)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, MRN)
          VALUES (@IncidentID, 'Staff', @Name, NULL)
        `);
    }

    if (visitorChecked === 'true' && visitor_name) {
      await pool.request()
        .input("IncidentID", sql.Int, incident_id)
        .input("Name", sql.NVarChar, visitor_name)
        .query(`
          INSERT INTO AffectedIndividuals (IncidentID, Type, Name, MRN)
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

app.get("/quality" ,requireLogin,async (req, res) => {
  console.log("Quality endpoint hit, user:", req.session.user);
  let pool;
  try {
    pool = await sql.connect(dbConfig);

  const query = `
 WITH IncidentBase AS (
    SELECT 
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
        i.DepartmentID,
        i.ImmediateAction,
        i.IncidentDateSubmitted,
        d.DepartmentName,
        STRING_AGG(a.Attachment, ', ') AS Attachment
    FROM Incidents i
    JOIN Reporters r ON i.ReporterID = r.ReporterID
    LEFT JOIN IncidentDepartments id ON i.IncidentID = id.IncidentID
    LEFT JOIN Departments d ON id.DepartmentID = d.DepartmentID
    LEFT JOIN Attachments a ON i.IncidentID = a.IncidentID
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
        i.status,
        i.responded,
        i.DepartmentID,
        i.ImmediateAction,
        i.IncidentDateSubmitted,
        d.DepartmentName
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
    LEFT JOIN Users u ON TRY_CAST(u.UserID AS int) = q.QualityID
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

    -- Department responses as JSON
    (
        SELECT dr.ResponseID, dr.Reason, dr.CorrectiveAction, dr.ResponseDate, dr.DueDate, d2.DepartmentName
        FROM DepartmentResponse dr
        LEFT JOIN Departments d2 ON dr.DepartmentID = d2.DepartmentID
        WHERE dr.IncidentID = ib.IncidentID
        FOR JSON PATH
    ) AS Responses,

    -- Affected individuals
    STUFF((
        SELECT ', ' + ai2.Name
        FROM AffectedIndividuals ai2
        WHERE ai2.IncidentID = ib.IncidentID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVarChar(MAX)'), 1, 2, '') AS AffectedIndividualsNames,

    STUFF((
        SELECT ', ' + ai2.Type
        FROM AffectedIndividuals ai2
        WHERE ai2.IncidentID = ib.IncidentID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVarChar(MAX)'), 1, 2, '') AS AffectedIndividualsType

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
app.get("/assigned-departments",requireLogin, async (req, res) => {
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

app.put("/quality", requireLogin,async (req, res) => {
  let isAuthenticated = false;
  let userDeptId = null;

  if (req.session.user) {
    isAuthenticated = true;
    userDeptId = req.session.user.departmentId;
  } else if (req.headers.authorization) {
    isAuthenticated = true;
  }

  if (!isAuthenticated) {
    return res.status(401).json({ status: "error", message: "Unauthorized" });
  }

  // Check if user is from Quality Management department (ID 34,)
const allowedDepts = [34, 39];

if (userDeptId && !allowedDepts.includes(userDeptId)) {
  return res.status(403).json({
    status: "error",
    message: "Only Quality Management can assign departments"
  });
}


  const { incidentId, departmentId } = req.body;

  if (!incidentId || !departmentId) {
    return res.status(400).json({ 
      status: "error", 
      message: "IncidentID and DepartmentID are required" 
    });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);

    // Start a transaction to ensure data consistency
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Check if incident exists
      const incidentCheck = await transaction.request()
        .input("incidentId", sql.Int, incidentId)
        .query("SELECT IncidentID FROM Incidents WHERE IncidentID = @incidentId");

      if (incidentCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ status: "error", message: "Incident not found" });
      }

      // Check if department exists
      const deptCheck = await transaction.request()
        .input("departmentId", sql.Int, departmentId)
        .query("SELECT DepartmentID FROM Departments WHERE DepartmentID = @departmentId");

      if (deptCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ status: "error", message: "Department not found" });
      }

      // Check if assignment already exists
      const existingAssignment = await transaction.request()
        .input("incidentId", sql.Int, incidentId)
        .input("departmentId", sql.Int, departmentId)
        .query(`
          SELECT * FROM IncidentDepartments 
          WHERE IncidentID = @incidentId AND DepartmentID = @departmentId
        `);

      if (existingAssignment.recordset.length === 0) {
        // Insert new assignment
        await transaction.request()
          .input("incidentId", sql.Int, incidentId)
          .input("departmentId", sql.Int, departmentId)
          .query(`
            INSERT INTO IncidentDepartments (IncidentID, DepartmentID, RespondedFlag)
            VALUES (@incidentId, @departmentId, 'false');
          `);
      }

      // Update incident status
      await transaction.request()
        .input("incidentId", sql.Int, incidentId)
        .query(`
          UPDATE Incidents
          SET status = 'Assigned' 
          WHERE IncidentID = @incidentId;
        `);

      await transaction.commit();

      res.json({ 
        status: "success", 
        message: "Department assigned and status updated to Assigned" 
      });

    } catch (err) {
      await transaction.rollback();
      throw err;
    }

  } catch (error) {
    console.error("Error assigning department:", error);
    res.status(500).json({ 
      status: "error", 
      message: "Failed to assign department: " + error.message 
    });
  } finally {
    if (pool) await pool.close();
  }
});
//------------------------GET All Departments FOR Forwarding the incident-------------------------

app.get('/departments',async (req, res) => {
  let pool;
  try {
    console.log('Fetching departments, session:', req.session);
    pool = await sql.connect(dbConfig);
    console.log('Database connected successfully');
    
    const result = await pool.request().query(`
      SELECT DepartmentID, DepartmentName
      FROM Departments
      WHERE DepartmentName IS NOT NULL
        AND DepartmentName NOT IN (N'Quality Management', N'Quality Management')
      ORDER BY DepartmentName
    `);
    
    console.log('Departments fetched:', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    console.error('GET /departments error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch departments', 
      detail: err.message 
    });
  } finally {
    if (pool) {
      console.log('Closing database connection');
      await pool.close().catch(err => console.error('Error closing pool:', err));
    }
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
    const userId = parseInt(req.session.user.id);
    
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
app.get("/departments/:departmentId", requireLogin, async (req, res) => {
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
          i.IncidentDateSubmitted, -- Added
          i.Location,
          r.Name AS ReporterName,
          r.Title AS ReporterTitle,
          i.Description AS IncidentDescription,
          i.status,
          i.responded,
          i.DepartmentID,
          d.DepartmentName,
          id.RespondedFlag,
          (
            SELECT STRING_AGG(a.Attachment, ', ')
            FROM Attachments a
            WHERE a.IncidentID = i.IncidentID
          ) AS Attachment,
          (
            SELECT 
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
            FOR JSON PATH
          ) AS Responses,
          q.Type AS FeedbackType,
          q.Categorization AS FeedbackCategorization,
          q.RiskScoring AS FeedbackRiskScoring,
          q.EffectivenessResult AS FeedbackEffectiveness,
          q.feedbackdate AS FeedbackDate, -- Added (note the lowercase 'feedbackdate' to match /quality)
          q.QualityID,
          u.UserName AS QualitySpecialistName,
          CASE WHEN q.FeedbackFlag = 'true' THEN 1 ELSE 0 END AS FeedbackFlag,
          CASE WHEN q.ReviewedFlag = 'true' THEN 1 ELSE 0 END AS ReviewedFlag,
          STUFF(
            (
              SELECT ', ' + ai2.Name
              FROM AffectedIndividuals ai2
              WHERE ai2.IncidentID = i.IncidentID
              FOR XML PATH(''), TYPE
            ).value('.', 'NVarChar(MAX)'), 1, 2, ''
          ) AS AffectedIndividualsNames
        FROM Incidents i
        JOIN Reporters r ON i.ReporterID = r.ReporterID
        JOIN IncidentDepartments id ON i.IncidentID = id.IncidentID
        LEFT JOIN Departments d ON id.DepartmentID = d.DepartmentID
        LEFT JOIN QualityReviews q ON q.IncidentID = i.IncidentID
        LEFT JOIN Users u ON q.QualityID = TRY_CAST(u.UserID AS int)
        WHERE id.DepartmentID = @departmentId
        ORDER BY i.IncidentID DESC;
      `);

    console.log(`Found ${result.recordset.length} incidents for department ${departmentId}`);
    
    if (result.recordset.length > 0) {
      console.log("Sample record:", {
        IncidentID: result.recordset[0].IncidentID,
        DepartmentName: result.recordset[0].DepartmentName,
        IncidentDateSubmitted: result.recordset[0].IncidentDateSubmitted,
        FeedbackDate: result.recordset[0].FeedbackDate,
        Responses: result.recordset[0].Responses,
        RespondedFlag: result.recordset[0].RespondedFlag
      });
    }

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

  const trimmedUserID = UserID.trim();

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool
      .request()
      .input("UserID", sql.VarChar, trimmedUserID)
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
      id: user.UserID.trim(),
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
if (req.session.user.id.toString() !== "1033") {
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

    const qualityId = parseInt(req.session.user.id);

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
        .input("qualityId", sql.Int, qualityId)
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
app.put("/quality/close-incident", requireLogin, async (req, res) => {
  const { IncidentID } = req.body; 
  if (!IncidentID) {
    return res.status(400).json({ status: "error", message: "Incident ID is required" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const DoneDate = new Date();

    await pool.request()
      .input("IncidentID",sql.Int, IncidentID)
      .input("DoneDate",sql.DateTime, DoneDate)
      .query(`
        UPDATE Incidents
        SET status = 'Done',
        DoneDate = @DoneDate
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
app.get("/incident-per-date", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const query = `
      SELECT
          d.DepartmentName,
          COUNT(i.IncidentID) AS IncidentCount,
          AVG(CAST(DATEDIFF(MINUTE, i.IncidentDateSubmitted, i.DoneDate) AS FLOAT)/60.0) AS AvgResolutionHours
      FROM Incidents i
      LEFT JOIN DepartmentResponse dr ON i.IncidentID = dr.IncidentID
      LEFT JOIN Departments d ON dr.DepartmentID = d.DepartmentID
      WHERE i.DoneDate IS NOT NULL
      GROUP BY d.DepartmentName
      ORDER BY AvgResolutionHours DESC;


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

//----------------------------------Put users data------------------------
//FETCH CURRENT USERS
app.get("/users", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const query = `
      SELECT 
          u.UserID, 
          u.UserName, 
          u.DepartmentID, 
          u.PhoneNumber, 
          u.Email, 
          d.DepartmentName
        FROM Users u
        JOIN Departments d
          ON u.DepartmentID = d.DepartmentID
        ORDER BY u.UserName;
    `;

    const result = await pool.request().query(query);
    console.log("Users data:", result.recordset);

    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

/*--------------------------------*/
// DELETE USER
app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'User ID is required' 
    });
  }

  let pool;
  let transaction;
  
  try {
    pool = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Check if user exists
    const checkQuery = `SELECT UserID FROM Users WHERE UserID = @UserID`;
    const checkResult = await transaction.request()
      .input("UserID", sql.VarChar, id.trim())
      .query(checkQuery);

    if (checkResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ 
        status: 'error', 
        message: 'User not found' 
      });
    }

    // Delete the user
    const deleteQuery = `DELETE FROM Users WHERE UserID = @UserID`;
    const result = await transaction.request()
      .input("UserID", sql.VarChar, id.trim())
      .query(deleteQuery);

    await transaction.commit();
    console.log("User deleted successfully:", id);

    res.json({ 
      status: "success", 
      message: "User deleted successfully"
    });

  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error("Error deleting user:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

/*--------------------------------*/
// UPDATE/CREATE USER
app.put("/users", async (req, res) => {
  let { UserID, UserName, DepartmentID, PhoneNumber, Email, Password } = req.body;

  // Trim inputs
  UserID = UserID ? UserID.trim() : null;
  UserName = UserName ? UserName.trim() : null;
  Email = Email ? Email.trim() : null;
  PhoneNumber = PhoneNumber ? PhoneNumber.trim() : null;

  // -------------------- Basic Validation --------------------
  if (!UserName || !Email) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'UserName and Email are required' 
    });
  }

  let pool;
  let transaction;

  try {
    pool = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    let result;
    let userExists = false;

    // Check if user exists in database (if UserID is provided)
    if (UserID) {
      const checkResult = await transaction.request()
        .input("UserID", sql.VarChar(10), UserID)
        .query("SELECT UserID FROM Users WHERE UserID = @UserID");
      
      userExists = checkResult.recordset.length > 0;
    }

    if (userExists) {
      // -------------------- UPDATE EXISTING USER --------------------
      console.log("Updating user with ID:", UserID);

      // Build dynamic update query
      let updateFields = [];
      let queryParams = { UserID };

      updateFields.push("UserName = @UserName");
      queryParams.UserName = UserName;

      updateFields.push("PhoneNumber = @PhoneNumber");
      queryParams.PhoneNumber = PhoneNumber || null;

      updateFields.push("Email = @Email");
      queryParams.Email = Email;

      if (Password && Password.trim() !== '') {
        updateFields.push("Password = @Password");
        queryParams.Password = Password;
      }

      if (DepartmentID) {
        updateFields.push("DepartmentID = @DepartmentID");
        queryParams.DepartmentID = DepartmentID;
      }

      const updateQuery = `
        UPDATE Users
        SET ${updateFields.join(', ')}
        WHERE UserID = @UserID
      `;

      const request = transaction.request();
      Object.keys(queryParams).forEach(key => {
        if (key === 'DepartmentID') {
          request.input(key, sql.Int, queryParams[key]);
        } else {
          request.input(key, sql.NVarChar, queryParams[key]);
        }
      });

      result = await request.query(updateQuery);
      console.log("User updated successfully");

    } else {
      // -------------------- INSERT NEW USER --------------------
      console.log("Creating new user");

      if (!DepartmentID || !Password || !UserID) {
        await transaction.rollback();
        return res.status(400).json({ 
          status: 'error', 
          message: 'UserID, DepartmentID, and Password are required for new users' 
        });
      }

      // Check if Email already exists (for new users)
      const emailCheck = await transaction.request()
        .input("Email", sql.NVarChar, Email)
        .query("SELECT UserID FROM Users WHERE Email = @Email");

      if (emailCheck.recordset.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          status: 'error', 
          message: 'Email already exists' 
        });
      }

      // Check if UserName already exists (for new users)
      const usernameCheck = await transaction.request()
        .input("UserName", sql.NVarChar, UserName)
        .query("SELECT UserID FROM Users WHERE UserName = @UserName");

      if (usernameCheck.recordset.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          status: 'error', 
          message: 'Username already exists' 
        });
      }

      // Insert new user with manual UserID
      const insertQuery = `
        INSERT INTO Users (UserID, UserName, Password, PhoneNumber, Email, DepartmentID)
        OUTPUT INSERTED.UserID
        VALUES (@UserID, @UserName, @Password, @PhoneNumber, @Email, @DepartmentID)
      `;

      result = await transaction.request()
        .input("UserID", sql.VarChar(10), UserID)
        .input("UserName", sql.NVarChar, UserName)
        .input("Password", sql.NVarChar, Password)
        .input("PhoneNumber", sql.NVarChar, PhoneNumber || null)
        .input("Email", sql.NVarChar, Email)
        .input("DepartmentID", sql.Int, DepartmentID)
        .query(insertQuery);

      console.log("New user created with ID:", result.recordset[0]?.UserID);
    }

    await transaction.commit();

    res.json({ 
      status: "success", 
      message: userExists ? "User updated successfully" : "User created successfully",
      data: result.recordset 
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error in user operation:", error);

    // Handle unique constraint errors
    if (error.message.includes('UNIQUE KEY constraint')) {
      return res.status(400).json({ 
        status: "error", 
        message: "Username, Email, or UserID already exists" 
      });
    }

    res.status(500).json({ 
      status: "error", 
      message: error.message 
    });

  } finally {
    if (pool) await pool.close();
  }
});
/*--------------------------------*/

app.post("/users", async (req, res) => {
  let { UserID, UserName, DepartmentID, PhoneNumber, Email, Password } = req.body;

  // Trim inputs
  UserID = UserID ? UserID.trim() : null;
  UserName = UserName ? UserName.trim() : null;
  Email = Email ? Email.trim() : null;
  PhoneNumber = PhoneNumber ? PhoneNumber.trim() : null;

  if (!UserID || !UserName || !Email || !DepartmentID || !Password) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'UserID, UserName, Email, DepartmentID, and Password are required' 
    });
  }

  let pool;
  let transaction;

  try {
    pool = await sql.connect(dbConfig);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Check if UserID already exists
    const userIDCheck = await transaction.request()
      .input("UserID", sql.VarChar(10), UserID)
      .query("SELECT UserID FROM Users WHERE UserID = @UserID");

    if (userIDCheck.recordset.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        status: 'error', 
        message: 'UserID already exists! Please choose another one.' 
      });
    }

    // Check if Email already exists
    const emailCheck = await transaction.request()
      .input("Email", sql.NVarChar, Email)
      .query("SELECT UserID FROM Users WHERE Email = @Email");

    if (emailCheck.recordset.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        status: 'error', 
        message: 'Email already exists' 
      });
    }

    // Insert new user
    const insertQuery = `
      INSERT INTO Users (UserID, UserName, Password, PhoneNumber, Email, DepartmentID)
      OUTPUT INSERTED.UserID
      VALUES (@UserID, @UserName, @Password, @PhoneNumber, @Email, @DepartmentID)
    `;

    const result = await transaction.request()
      .input("UserID", sql.VarChar(10), UserID)
      .input("UserName", sql.NVarChar, UserName)
      .input("Password", sql.NVarChar, Password)
      .input("PhoneNumber", sql.NVarChar, PhoneNumber || null)
      .input("Email", sql.NVarChar, Email)
      .input("DepartmentID", sql.Int, DepartmentID)
      .query(insertQuery);

    await transaction.commit();

    res.json({ 
      status: "success", 
      message: "User created successfully",
      data: result.recordset 
    });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error creating user:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message 
    });
  } finally {
    if (pool) await pool.close();
  }
});


//---------------- Check whether the userID exist in the database or not (needed for inserting a new user)-----

app.post('/departments',requireLogin, async (req, res) => {
  const { DepartmentName } = req.body;

  // Validate input
  if (!DepartmentName) {
    return res.status(400).json({ status: 'error', message: 'Department Name is required' });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    
    await pool
      .request()
      .input('DepartmentName', sql.NVarChar, DepartmentName)
      .query(`
        INSERT INTO Departments (DepartmentName)
        VALUES (@DepartmentName);
      `);

    res.json({ status: 'success', message: 'Department added successfully' });
  } catch (err) {
    console.error('Error adding department:', err);
    res.status(500).json({ status: 'error', message: 'Failed to add department' });
  } finally {
    if (pool) await pool.close();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});