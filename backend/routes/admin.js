const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

/**
 * GET all students with filters
 * Admin only
 * /api/admin/studentss
 */
router.get("/studentss", auth("admin"), async (req, res) => {
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
      FROM studentss
      WHERE 1=1
    `;

    let values = [];
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
    res.json(result.rows);

  } catch (err) {
    console.error("Admin fetch students error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Blacklist student by enrollment number
 * Admin only
 * /api/admin/blacklist/:enrollment_no
 */
router.put("/blacklist/:enrollment_no", auth("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE studentss 
       SET is_blacklisted = true 
       WHERE enrollment_no = $1 
       RETURNING enrollment_no`,
      [req.params.enrollment_no]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Student blacklisted successfully" });

  } catch (err) {
    console.error("Blacklist error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Unblacklist student
 * Admin only
 * /api/admin/unblacklist/:enrollment_no
 */
router.put("/unblacklist/:enrollment_no", auth("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE studentss 
       SET is_blacklisted = false 
       WHERE enrollment_no = $1 
       RETURNING enrollment_no`,
      [req.params.enrollment_no]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Student removed from blacklist" });

  } catch (err) {
    console.error("Unblacklist error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
