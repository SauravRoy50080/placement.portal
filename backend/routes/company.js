import { Router } from "express";
import pool from "../db.js";
import auth from "../middleware/auth.js";
import sendMail from "../utils/mailer.js";

const router = Router();

/**
 * GET all companies (with filters)
 * Accessible by admin & students
 * /api/company?branch=CSE&minPackage=600000&domain=IT
 */
router.get("/", auth(), async (req, res) => {
  try {
    const { branch, minPackage, domain } = req.query;

    let query = `
      SELECT id, name, domain, location, eligibility_criteria,
             branches_allowed, salary_package
      FROM companies
      WHERE 1=1
    `;
    let values = [];
    let idx = 1;

    if (branch) {
      query += ` AND $${idx} = ANY(branches_allowed)`;
      values.push(branch);
      idx++;
    }

    if (minPackage) {
      query += ` AND salary_package >= $${idx}`;
      values.push(minPackage);
      idx++;
    }

    if (domain) {
      query += ` AND domain ILIKE $${idx}`;
      values.push(`%${domain}%`);
      idx++;
    }

    query += ` ORDER BY salary_package DESC`;

    const result = await pool.query(query, values);
    res.status(200).json({ companies: result.rows });

  } catch (err) {
    console.error("Fetch companies error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET single company by ID
 * /api/company/:id
 */
router.get("/:id", auth(), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, name, domain, location, eligibility_criteria,
              branches_allowed, salary_package
       FROM companies
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.status(200).json({ company: result.rows[0] });

  } catch (err) {
    console.error("Fetch company error:", err.message);
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
    const {
      name,
      domain,
      location,
      eligibility_criteria,
      branches_allowed,
      salary_package,
      min_cgpa,
      required_skills
    } = req.body;

    if (!name || !branches_allowed || !salary_package || !min_cgpa) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Insert company
    const companyResult = await pool.query(
      `INSERT INTO companies
       (name, domain, location, eligibility_criteria,
        branches_allowed, salary_package, min_cgpa, required_skills)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        name,
        domain,
        location,
        eligibility_criteria,
        branches_allowed,
        salary_package,
        min_cgpa,
        required_skills
      ]
    );

    // Find eligible students
    const students = await pool.query(
      `SELECT name, email
       FROM students
       WHERE cgpa >= $1
       AND branch = ANY($2)
       AND skills && $3
       AND is_blacklisted = false`,
      [min_cgpa, branches_allowed, required_skills]
    );

    // Send notification emails
    for (const student of students.rows) {
      await sendMail(
        student.email,
        `New Placement Opportunity – ${name}`,
        `Hello ${student.name},

A new company "${name}" has opened placement registrations.

You are eligible based on your profile.
Please login to the placement portal to apply.

– Placement Cell`
      );
    }

    res.status(201).json({
      message: "Company created & emails sent",
      company: companyResult.rows[0],
      notified_students: students.rowCount
    });

  } catch (err) {
    console.error("Create company error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * UPDATE company
 * Admin only
 */
router.put("/:id", auth("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE companies
       SET name=$1, domain=$2, location=$3,
           eligibility_criteria=$4, branches_allowed=$5, salary_package=$6
       WHERE id=$7
       RETURNING *`,
      [
        req.body.name,
        req.body.domain,
        req.body.location,
        req.body.eligibility_criteria,
        req.body.branches_allowed,
        req.body.salary_package,
        id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({ message: "Company updated", company: result.rows[0] });

  } catch (err) {
    console.error("Update company error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE company
 * Admin only
 */
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM companies WHERE id=$1 RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({ message: "Company deleted" });

  } catch (err) {
    console.error("Delete company error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
