import { Router } from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = Router();

/**
 * GET eligible companies for the logged-in student
 * Accessible by students only
 * /api/student/eligible-companies
 */
router.get("/eligible-companies", auth("student"), async (req, res) => {
  try {
    // Fetch student using enrollment_no from JWT
    const studentResult = await pool.query(
      `SELECT enrollment_no, branch, cgpa, is_blacklisted
       FROM students
       WHERE enrollment_no = $1`,
      [req.user.enrollment_no]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const student = studentResult.rows[0];

    // Check if student is blacklisted
    if (student.is_blacklisted) {
      return res.status(403).json({
        error: "You are blacklisted and cannot apply to companies."
      });
    }

    // Fetch eligible companies
    const companiesResult = await pool.query(
      `SELECT *
       FROM companies
       WHERE min_cgpa <= $1
       AND $2 = ANY(branches_allowed)
       ORDER BY package DESC`,
      [student.cgpa, student.branch]
    );

    res.status(200).json({ companies: companiesResult.rows });

  } catch (err) {
    console.error("Fetch eligible companies error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST apply to a company
 * Accessible by students only
 * /api/student/apply/:companyId
 */
router.post("/apply/:companyId", auth("student"), async (req, res) => {
  try {
    const { companyId } = req.params;

    // Fetch student
    const studentResult = await pool.query(
      `SELECT enrollment_no, branch, cgpa, is_blacklisted
       FROM students
       WHERE enrollment_no = $1`,
      [req.user.enrollment_no]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const student = studentResult.rows[0];

    if (student.is_blacklisted) {
      return res.status(403).json({
        error: "You are blacklisted and cannot apply to companies."
      });
    }

    // Fetch company
    const companyResult = await pool.query(
      `SELECT id, min_cgpa, branches_allowed
       FROM companies
       WHERE id = $1`,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const company = companyResult.rows[0];

    // Eligibility check
    if (
      student.cgpa < company.min_cgpa ||
      !company.branches_allowed.includes(student.branch)
    ) {
      return res.status(403).json({
        error: "You are not eligible to apply for this company."
      });
    }

    // Prevent duplicate application
    const applicationCheck = await pool.query(
      `SELECT 1
       FROM applications
       WHERE student_enrollment_no = $1
       AND company_id = $2`,
      [student.enrollment_no, company.id]
    );

    if (applicationCheck.rows.length > 0) {
      return res.status(400).json({
        error: "You have already applied to this company."
      });
    }

    // Insert application
    await pool.query(
      `INSERT INTO applications (student_enrollment_no, company_id, applied_on)
       VALUES ($1, $2, NOW())`,
      [student.enrollment_no, company.id]
    );

    res.status(201).json({ message: "Applied successfully." });

  } catch (err) {
    console.error("Apply company error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
