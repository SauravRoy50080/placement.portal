router.get("/studentss", auth("admin"), async (req, res) => {
  try {
    const { branch, minCgpa, skill, blacklisted } = req.query;

    let query = `
      SELECT id, name, college_email, branch, cgpa, skills, is_blacklisted
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
    console.error("Admin student filter error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
