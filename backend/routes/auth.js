import { Router } from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

/**
 * Student Login
 * POST /api/auth/student/login
 */
router.post("/student/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    email = email.trim().toLowerCase();

    // Fetch student
    const result = await pool.query(
      `SELECT
         enrollment_no,
         name,
         college_email,
         password,
         is_blacklisted
       FROM students
       WHERE college_email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const student = result.rows[0];

    // Check blacklist
    if (student.is_blacklisted) {
      return res.status(403).json({
        error: "Your account has been blacklisted. Contact admin."
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, student.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        enrollment_no: student.enrollment_no,
        role: "student"
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

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
    console.error("Student login error:", err.message);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});

export default router;
