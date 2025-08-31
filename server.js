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
    cookie: { secure: false },// false for localhost
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

app.get("/quality", requireLogin,async (req, res) => {
  console.log("Quality endpoint hit, user:", req.session.user);
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const query = `
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
          i.Attachments,
          i.DepartmentID,
          i.ImmediateAction,
          d.DepartmentName,

          q.ReviewedFlag,
          q.feedbackdate AS FeedbackDate,
          q.ReviewedDate,
          MAX(q.Type) AS FeedbackType,
          MAX(q.Categorization) AS FeedbackCategorization,
          MAX(q.RiskScoring) AS FeedbackRiskScoring,
          MAX(q.EffectivenessResult) AS FeedbackEffectiveness,
          MAX(q.QualityID) AS QualityID,
          MAX(u.UserName) AS QualitySpecialistName,
          CASE WHEN MAX(q.FeedbackFlag) = 'true' THEN 1 ELSE 0 END AS FeedbackFlag,

          (
            SELECT dr.ResponseID, dr.Reason, dr.CorrectiveAction, dr.ResponseDate, dr.DueDate, d2.DepartmentName
            FROM DepartmentResponse dr
            LEFT JOIN Departments d2 ON dr.DepartmentID = d2.DepartmentID
            WHERE dr.IncidentID = i.IncidentID
            FOR JSON PATH
          ) AS Responses,

          -- Affected individuals list
          STUFF((
            SELECT ', ' + ai2.Name
            FROM AffectedIndividuals ai2
            WHERE ai2.IncidentID = i.IncidentID
            FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS AffectedIndividualsNames

      FROM Incidents i
      JOIN Reporters r ON i.ReporterID = r.ReporterID
      LEFT JOIN Departments d ON i.DepartmentID = d.DepartmentID
      LEFT JOIN QualityReviews q ON q.IncidentID = i.IncidentID
      LEFT JOIN Users u ON q.QualityID = u.UserID

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
          i.Attachments,
          i.DepartmentID,
          i.ImmediateAction,
          d.DepartmentName,
          q.ReviewedFlag,
          q.FeedbackDate,
          q.ReviewedDate
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
        UPDATE Incidents
        SET DepartmentID = @departmentId,
            status = 'Assigned' 
        WHERE IncidentID = @incidentId
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

app.get("/departments", requireLogin, async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(`
      SELECT DepartmentID, DepartmentName
      FROM Departments
      WHERE DepartmentName <> 'Quality Mangement'
      ORDER BY DepartmentName
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (pool) await pool.close();
  }
});

//----------------------------- Add/Update Department Response ------------------------
app.put("/department-response", requireLogin, async (req, res) => {
  const { ResponseID, IncidentID, DepartmentID, Reason, CorrectiveAction, DueDate } = req.body;

  if (!IncidentID || !DepartmentID) {
    return res.status(400).json({ status: "error", message: "IncidentID and DepartmentID are required" });
  }

  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const now = new Date(); 
    let responseIdResult;

    if (ResponseID) {
      // UPDATE existing response
      await pool.request()
        .input("ResponseID", sql.Int, ResponseID)
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
          WHERE ResponseID = @ResponseID
        `);
      
      responseIdResult = ResponseID;
    } else {
      // INSERT new response
      const result = await pool.request()
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
    }

    // Update incident status to 'Pending' after department responds
    await pool.request()
      .input("incidentId", sql.Int, IncidentID)
      .query(`
        UPDATE Incidents
        SET responded = 'Yes',
            status = 'Pending'
        WHERE IncidentID = @incidentId
      `);

    res.json({ 
      status: "success", 
      message: ResponseID ? "Response updated successfully" : "Response saved successfully",
      ResponseID: responseIdResult 
    });

  } catch(err) {
    console.error("Error saving department response:", err);
    res.status(500).json({ status: "error", message: err.message });
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
        .input("Type", sql.VarChar(255), type)
        .input("Categorization", sql.VarChar(255), categorization)
        .input("RiskScoring", sql.Int, risk)
        .input("EffectivenessResult", sql.VarChar(50), effectiveness)
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
        .input("Type", sql.VarChar(255), type)
        .input("Categorization", sql.VarChar(255), categorization)
        .input("RiskScoring", sql.Int, risk)
        .input("EffectivenessResult", sql.VarChar(50), effectiveness)
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
app.get("/departments/:departmentId",async (req, res) => {
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
            q.ReviewedFlag,
            MAX(CAST(dr.Reason AS NVARCHAR(MAX))) AS Reason,
            MAX(CAST(dr.CorrectiveAction AS NVARCHAR(MAX))) AS CorrectiveAction,
            MAX(q.Type) AS Type,
            MAX(q.Categorization) AS FeedbackCategorization,
            MAX(q.RiskScoring) AS FeedbackRiskScoring,
            MAX(q.EffectivenessResult) AS FeedbackEffectiveness,
            CASE WHEN MAX(CAST(q.ReviewedFlag AS INT)) = 1 THEN 1 ELSE 0 END AS FeedbackFlag, 
            MAX(dr.DueDate) AS DueDate,
            MAX(dr.ResponseDate) AS ResponseDate, 
            STUFF((
              SELECT ', ' + ai2.Name
              FROM AffectedIndividuals ai2
              WHERE ai2.IncidentID = i.IncidentID
              FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS AffectedIndividualsNames, 
            STUFF((
              SELECT ', ' + ai2.Type + ': ' + ai2.Name
              FROM AffectedIndividuals ai2
              WHERE ai2.IncidentID = i.IncidentID
              FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS AffectedList 
        FROM Incidents i
        JOIN Reporters r ON i.ReporterID = r.ReporterID
        LEFT JOIN Departments d ON i.DepartmentID = d.DepartmentID
        LEFT JOIN QualityReviews q ON q.IncidentID = i.IncidentID
        LEFT JOIN DepartmentResponse dr ON dr.IncidentID = i.IncidentID
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
            i.status,
            i.responded,
            i.Attachments,
            i.DepartmentID,
            d.DepartmentName,
            q.ReviewedFlag
        ORDER BY i.IncidentID DESC;
      `);
    res.json({ status: "success", data: result.recordset });
  } catch (err) {
    console.error(err);
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
app.put('/quality/reviewed', async (req, res) => {
  let pool;
  try {
    console.log("Received request body:", req.body);
    console.log("Session user:", req.session?.user);
    console.log("Request headers:", req.headers);

    const { IncidentID, reviewedBy, userId, qualityId } = req.body;
    
    // Validate required fields
    if (!IncidentID) {
      console.log("Missing IncidentID");
      return res.status(400).json({ 
        status: "error", 
        message: "IncidentID is required" 
      });
    }

    // Get current user ID from multiple sources
    let currentUserId = null;
    
    // Try to get from session first
    if (req.session?.user?.id) {
      currentUserId = req.session.user.id;
      console.log("Got user ID from session:", currentUserId);
    }
    // Try from request body
    else if (userId) {
      currentUserId = parseInt(userId);
      console.log("Got user ID from request body:", currentUserId);
    }
    else if (qualityId) {
      currentUserId = parseInt(qualityId);
      console.log("Got quality ID from request body:", currentUserId);
    }
    // Try to extract from JWT token if using token-based auth
    else if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        console.log("Token found but no JWT decode implemented");
      } catch (tokenError) {
        console.log("Token decode failed:", tokenError.message);
      }
    }

    console.log("Final current user ID:", currentUserId);

    // Check if we have a user ID
    if (!currentUserId) {
      console.log("No user ID found in session, body, or token");
      return res.status(401).json({ 
        status: "error", 
        message: "User not authenticated" 
      });
    }

    // Check if user is authorized (must be UserID = 1033)
    if (parseInt(currentUserId) !== 1033) {
      console.log("Unauthorized user attempting to review:", currentUserId);
      return res.status(403).json({ 
        status: "error", 
        message: `Unauthorized: Only quality managers (ID: 1033) can review incidents. Your ID: ${currentUserId}` 
      });
    }

    console.log("User authorized as quality manager (1033)");

    pool = await sql.connect(dbConfig);
    
    // First check if the incident exists and has feedback
    const checkResult = await pool
      .request()
      .input("IncidentID", sql.Int, parseInt(IncidentID))
      .query(`
        SELECT IncidentID, FeedbackFlag, ReviewedFlag
        FROM QualityReviews 
        WHERE IncidentID = @IncidentID
      `);

    if (checkResult.recordset.length === 0) {
      console.log("Incident not found in QualityReviews:", IncidentID);
      return res.status(404).json({ 
        status: "error", 
        message: "Incident not found in quality reviews" 
      });
    }

    const incident = checkResult.recordset[0];
    console.log("Found incident:", incident);

    // Check if feedback exists
    if (incident.FeedbackFlag !== 1) {
      return res.status(400).json({ 
        status: "error", 
        message: "Cannot review incident without feedback" 
      });
    }

    // Check if already reviewed
    if (incident.ReviewedFlag === 1) {
      return res.status(400).json({ 
        status: "error", 
        message: "Incident has already been reviewed" 
      });
    }

    const updateResult = await pool
      .request()
      .input("IncidentID", sql.Int, parseInt(IncidentID))
      .input("ReviewedBy", sql.VarChar(100), reviewedBy || "Quality Manager")
      .input("ReviewedDate", sql.DateTime, new Date())
      .input("QualityID", sql.Int, parseInt(currentUserId))
      .query(`
        UPDATE QualityReviews 
        SET ReviewedFlag = 1,
            ReviewedDate = @ReviewedDate,
        WHERE IncidentID = @IncidentID
      `);

    console.log("Update result rows affected:", updateResult.rowsAffected);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({ 
        status: "error", 
        message: "Failed to update incident review status" 
      });
    }

    console.log("Successfully marked incident as reviewed");

    return res.json({
      status: "success",
      message: "Incident marked as reviewed successfully",
      incidentID: IncidentID,
      reviewedBy: reviewedBy || "Quality Manager",
      qualityManagerId: currentUserId
    });

  } catch (err) {
    console.error("Quality review error:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({ 
      status: "error", 
      message: "Internal server error: " + err.message 
    });
  } finally {
    if (pool) await pool.close();
  }
});

// Optional: Add a helper endpoint to check current user info
app.get('/current-user', async (req, res) => {
  try {
    console.log("Current user request - Session:", req.session?.user);
    
    if (!req.session?.user) {
      return res.status(401).json({ 
        status: "error", 
        message: "Not authenticated" 
      });
    }

    return res.json({
      status: "success",
      userId: req.session.user.id,
      userName: req.session.user.name,
      departmentId: req.session.user.departmentId,
      isQualityManager: req.session.user.id === 1033
    });
  } catch (err) {
    console.error("Current user error:", err);
    return res.status(500).json({ 
      status: "error", 
      message: err.message 
    });
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

//-----------------barchart->Number of Incidents per department---------------------

app.get("/incident-per-department", requireLogin, async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const query = `
      SELECT 
          d.DepartmentName,
          SUM(CASE WHEN i.status = 'Assigned' THEN 1 ELSE 0 END) AS AssignedCount,
          SUM(CASE WHEN i.status = 'Pending' THEN 1 ELSE 0 END) AS PendingCount,
          SUM(CASE WHEN i.status = 'Done' THEN 1 ELSE 0 END) AS ClosedCount
      FROM Incidents i
      JOIN Departments d ON i.DepartmentID = d.DepartmentID
      WHERE d.DepartmentName IS NOT NULL
      GROUP BY d.DepartmentName
      ORDER BY d.DepartmentName;
    `;

    const result = await pool.request().query(query);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});

//------------------- Piechart-> Affected Individuals Type -------------------------

 app.get("/affected-types", requireLogin, async (req, res) => {
  let pool;

  try {
    pool = await sql.connect(dbConfig);
    const query = `
      SELECT ai.Type, 
      COUNT(*) AS Count
      FROM AffectedIndividuals ai
      GROUP BY ai.Type
      ORDER BY ai.Type;
    `;
    const result = await pool.request().query(query);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching affected individuals:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});
//------------------- LineChart->Incident count per days -------------------------
app.get("/incident-per-date", async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const query = `
        WITH Dates AS (
            SELECT DISTINCT IncidentDate
            FROM Incidents
        )
        SELECT d.IncidentDate,
              COALESCE(SUM(CASE WHEN i.status ='New' THEN 1 END), 0) AS NewIncidentCount,
              COALESCE(SUM(CASE WHEN i.status ='Assigned' THEN 1 END), 0) AS AssignedIncidentCount,
              COALESCE(SUM(CASE WHEN i.status = 'Pending' THEN 1 END), 0) AS PendingIncidentCount,
              COALESCE(SUM(CASE WHEN i.status = 'Closed' THEN 1 END), 0) AS ClosedIncidentCount
        FROM Dates d
        LEFT JOIN Incidents i ON i.IncidentDate = d.IncidentDate
        GROUP BY d.IncidentDate
        ORDER BY d.IncidentDate;


    `;

    const result = await pool.request().query(query);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching affected individuals:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});
//------------------------PieChart->responded or NOT----------------------------

app.get("/if-responded", requireLogin, async (req, res) => {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const query = `
      SELECT ai.responded, 
      COUNT(*) AS Count
      FROM Incidents ai
      GROUP BY ai.responded
      ORDER BY ai.responded;
    `;

    const result = await pool.request().query(query);
    res.json({ status: "success", data: result.recordset });
  } catch (error) {
    console.error("Error fetching affected individuals:", error);
    res.status(500).json({ status: "error", message: error.message });
  } finally {
    if (pool) await pool.close();
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});