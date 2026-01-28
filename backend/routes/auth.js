const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/**
 * Student Login
 * POST /api/auth/student/login
 */
router.post("/student/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    /* 1️⃣ Validate input */
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    /* 2️⃣ Fetch student from DB */
    const result = await pool.query(
      `SELECT 
         enrollment_no,
         name,
         college_email,
         password,
         is_blacklisted
       FROM studentss
       WHERE college_email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const student = result.rows[0];

    /* 3️⃣ Check blacklist status */
    if (student.is_blacklisted) {
      return res.status(403).json({
        error: "Your account has been blacklisted. Please contact the administrator."
      });
    }

    /* 4️⃣ Verify password */
    const isPasswordValid = await bcrypt.compare(password, student.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    /* 5️⃣ Generate JWT with expiration */
    const token = jwt.sign(
      {
        enrollment_no: student.enrollment_no,
        role: "student"
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h" // ⏳ token expires in 24 hours
      }
    );

    /* 6️⃣ Success response */
    res.status(200).json({
      message: "Login successful",
      token,
      expiresIn: "24h",
      student: {
        enrollment_no: student.enrollment_no,
        name: student.name,
        email: student.college_email
      }
    });

  } catch (err) {
    console.error("Student login error:", err);

    /* 7️⃣ Centralized error response */
    res.status(500).json({
      error: "Internal server error. Please try again later."
    });
  }
});

module.exports = router;
