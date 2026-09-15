
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// ===============================
// MongoDB Connection
// ===============================
const MONGODB_URI = "mongodb://clinicryanofficial_db_user:dashzer1503@ac-snwnffv-shard-00-00.b0wrbjy.mongodb.net:27017,ac-snwnffv-shard-00-01.b0wrbjy.mongodb.net:27017,ac-snwnffv-shard-00-02.b0wrbjy.mongodb.net:27017/?ssl=true&replicaSet=atlas-4x5es1-shard-0&authSource=admin&appName=Cluster0";

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI environment variable is not set.");
  process.exit(1);
}

// ===============================
// User Schema
// ===============================
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["manager", "employee"],
      default: "employee",
    },
    phone: { type: String },
    deviceId: { type: String },
    tlName: { type: String, default: "" },
    fcmToken: { type: String, default: null },
    dailyTarget: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    ryanEmployeeCode: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    strict: false,
  }
);

const User = mongoose.model("User", userSchema);

// ===============================
// Main Function
// ===============================
async function getUsersWithoutRyanEmployeeCode() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    await mongoose.connect(MONGODB_URI);

    console.log("✅ MongoDB connected.");

    // Find users where ryanEmployeeCode is:
    // 1. null
    // 2. 0
    // 3. "0"
    // 4. field does not exist
    const users = await User.find({
      $or: [
        { ryanEmployeeCode: null },
        { ryanEmployeeCode: 0 },
        { ryanEmployeeCode: "0" },
        { ryanEmployeeCode: { $exists: false } },
      ],
    })
      .select("-password")
      .lean();

    console.log(
      `\n📊 Found ${users.length} users without a valid Ryan Employee Code.\n`
    );

    // ===============================
    // Display Users
    // ===============================
    if (users.length > 0) {
      console.table(
        users.map((user) => ({
          ID: user._id?.toString(),
          Name: user.name || "",
          Email: user.email || "",
          Phone: user.phone || "",
          Role: user.role || "",
          RyanEmployeeCode:
            user.ryanEmployeeCode === undefined
              ? "MISSING"
              : user.ryanEmployeeCode,
          Active: user.isActive,
          CreatedAt: user.createdAt
            ? new Date(user.createdAt).toISOString()
            : "",
        }))
      );
    }

    // ===============================
    // Save JSON File
    // ===============================
    const outputPath = path.join(
      __dirname,
      "users_without_ryan_employee_code.json"
    );

    fs.writeFileSync(
      outputPath,
      JSON.stringify(users, null, 2),
      "utf8"
    );

    console.log(`\n✅ JSON file created:`);
    console.log(outputPath);

    // ===============================
    // Also create CSV
    // ===============================
    const csvPath = path.join(
      __dirname,
      "users_without_ryan_employee_code.csv"
    );

    const csvHeaders = [
      "_id",
      "name",
      "email",
      "phone",
      "role",
      "ryanEmployeeCode",
      "isActive",
      "tlName",
      "dailyTarget",
      "createdAt",
    ];

    const escapeCsv = (value) => {
      if (value === null || value === undefined) {
        return "";
      }

      const stringValue = String(value);

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const csvRows = users.map((user) =>
      [
        user._id?.toString(),
        user.name,
        user.email,
        user.phone,
        user.role,
        user.ryanEmployeeCode,
        user.isActive,
        user.tlName,
        user.dailyTarget,
        user.createdAt
          ? new Date(user.createdAt).toISOString()
          : "",
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows,
    ].join("\n");

    fs.writeFileSync(csvPath, csvContent, "utf8");

    console.log(`\n✅ CSV file created:`);
    console.log(csvPath);

    console.log("\n🎉 Done.");
  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
  }
}

// ===============================
// Run
// ===============================
getUsersWithoutRyanEmployeeCode();
