import { Router } from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";

const router = Router();

/**
 * GET all students with optional filters
 * Admin only
 * /api/admin/students
 */
router.get("/students", auth("admin"), async (req, res) => {
  try {
    const { branch, minCgpa, skill, blacklisted } = req.query;

    let query = `
      SELECT 
        enrollment_no,
        name,
        college_email,
        branch,
        cgpa,
        skills,
        is_blacklisted
      FROM students
      WHERE 1=1
    `;

    const values = [];
    let idx = 1;

    if (branch) {
      query += ` AND branch = $${idx}`;
      values.push(branch);
      idx++;
    }

    if (minCgpa) {
      query += ` AND cgpa >= $${idx}`;
      values.push(Number(minCgpa));
      idx++;
    }

    if (skill) {
      query += ` AND skills @> ARRAY[$${idx}]::TEXT[]`;
      values.push(skill);
      idx++;
    }

    if (blacklisted !== undefined) {
      query += ` AND is_blacklisted = $${idx}`;
      values.push(blacklisted === "true");
      idx++;
    }

    const result = await pool.query(query, values);
    res.status(200).json({ students: result.rows });

  } catch (err) {
    console.error("Admin fetch students error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Blacklist a student
 * /api/admin/blacklist/:enrollment_no
 */
router.put("/blacklist/:enrollment_no", auth("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE students
       SET is_blacklisted = true
       WHERE enrollment_no = $1
       RETURNING enrollment_no, name`,
      [req.params.enrollment_no]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json({
      message: "Student blacklisted successfully",
      student: result.rows[0]
    });

  } catch (err) {
    console.error("Blacklist student error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Unblacklist a student
 * /api/admin/unblacklist/:enrollment_no
 */
router.put("/unblacklist/:enrollment_no", auth("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE students
       SET is_blacklisted = false
       WHERE enrollment_no = $1
       RETURNING enrollment_no, name`,
      [req.params.enrollment_no]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json({
      message: "Student removed from blacklist successfully",
      student: result.rows[0]
    });

  } catch (err) {
    console.error("Unblacklist student error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
