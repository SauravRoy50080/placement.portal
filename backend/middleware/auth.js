
const jwt = require("jsonwebtoken");

module.exports = (role) => {
  return (req, res, next) => {
    try {
      // 1️⃣ Get token from headers
      let token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
      }

      // 2️⃣ Remove 'Bearer ' if present
      if (token.startsWith("Bearer ")) {
        token = token.slice(7, token.length).trim();
      }

      // 3️⃣ Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4️⃣ Check role if specified
      if (role && decoded.role !== role) {
        return res.status(403).json({ error: "Forbidden. You do not have access to this resource." });
      }

      // 5️⃣ Attach user info to request
      req.user = decoded;

      next();
    } catch (err) {
      console.error("Auth middleware error:", err.message);
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
};
