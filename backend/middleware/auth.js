const User = require("../models/User");

// Temporarily bypass authentication
const protect = async (req, res, next) => {
  try {
    // Optional: attach the first user from the database
    const user = await User.findOne();

    req.user = user || {
      _id: "test-user",
      role: "manager",
      isActive: true,
    };

    next();
  } catch (err) {
    next();
  }
};

// Allow everyone
const isManager = (req, res, next) => {
  next();
};

// Allow everyone
const isEmployee = (req, res, next) => {
  next();
};

module.exports = {
  protect,
  isManager,
  isEmployee,
};