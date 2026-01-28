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

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Fetch student
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

    // Check user exists
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const student = result.rows[0];

    // Block blacklisted students
    if (student.is_blacklisted) {
      return res.status(403).json({
        error: "You are blacklisted. Contact admin."
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, student.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        enrollment_no: student.enrollment_no,
        role: "student"
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Success response
    res.json({
      token,
      student: {
        enrollment_no: student.enrollment_no,
        name: student.name,
        email: student.college_email
      }
    });

  } catch (err) {
    console.error("Student login error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
