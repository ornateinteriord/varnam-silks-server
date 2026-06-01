require("dotenv").config();
const mongoose = require("mongoose");

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB:", process.env.MONGO_URI);
    
    const db = mongoose.connection.db;
    
    const userAdmin = await db.collection("user_tbl").findOne({ user_name: /^admin$/i });
    console.log("User admin regex:", userAdmin ? "FOUND" : "NOT FOUND");

    const adminAdmin = await db.collection("admin_tbl").findOne({ username: /^admin$/i });
    console.log("Admin admin regex:", adminAdmin ? "FOUND" : "NOT FOUND");

    if (adminAdmin) console.log(adminAdmin);
    if (userAdmin) console.log(userAdmin);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

test();
