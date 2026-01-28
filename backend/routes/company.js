const router = require("express").Router();
const pool = require("../db");
const auth = require("../middleware/auth");

/**
 * GET all companies
 * Accessible by both admin and students
 * /api/company
 */
router.get("/", auth(), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, domain, location, eligibility_criteria, package
       FROM companies
       ORDER BY name`
    );
    res.status(200).json({ companies: result.rows });
  } catch (err) {
    console.error("Fetch companies error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET single company by ID
 * Accessible by both admin and students
 * /api/company/:id
 */
router.get("/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, domain, location, eligibility_criteria, package
       FROM companies
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.status(200).json({ company: result.rows[0] });
  } catch (err) {
    console.error("Fetch company error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * CREATE new company
 * Admin only
 * /api/company
 */
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, domain, location, eligibility_criteria, package } = req.body;

    if (!name || !domain || !location || !eligibility_criteria || !package) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const result = await pool.query(
      `INSERT INTO companies (name, domain, location, eligibility_criteria, package)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, domain, location, eligibility_criteria, package`,
      [name, domain, location, eligibility_criteria, package]
    );

    res.status(201).json({
      message: "Company created successfully",
      company: result.rows[0]
    });
  } catch (err) {
    console.error("Create company error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * UPDATE company details
 * Admin only
 * /api/company/:id
 */
router.put("/:id", auth("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, location, eligibility_criteria, package } = req.body;

    const result = await pool.query(
      `UPDATE companies
       SET name = $1, domain = $2, location = $3, eligibility_criteria = $4, package = $5
       WHERE id = $6
       RETURNING id, name, domain, location, eligibility_criteria, package`,
      [name, domain, location, eligibility_criteria, package, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.status(200).json({
      message: "Company updated successfully",
      company: result.rows[0]
    });
  } catch (err) {
    console.error("Update company error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE a company
 * Admin only
 * /api/company/:id
 */
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM companies
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.status(200).json({ message: "Company deleted successfully" });
  } catch (err) {
    console.error("Delete company error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

