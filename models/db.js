const mongoose = require("mongoose");

// Global connection cache for serverless
let cachedConnection = null;

const connectDB = async () => {
  // Return cached connection if exists (CRITICAL for serverless)
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log("✅ Using cached MongoDB connection");
    return cachedConnection;
  }

  try {
    // Serverless-optimized connection options
    const options = {
      serverSelectionTimeoutMS: 30000, // Increased timeout for server selection
      socketTimeoutMS: 45000, // Socket timeout
      connectTimeoutMS: 30000, // Connection timeout
      maxPoolSize: 10, // Connection pool size for serverless
      minPoolSize: 1, // Keep at least 1 connection alive
      maxIdleTimeMS: 30000, // Close idle connections after 30s
      retryWrites: true,
      retryReads: true,
      bufferCommands: true, // Buffer commands while connecting
    };

    // Set global mongoose bufferTimeoutMS to prevent "buffering timed out" errors
    mongoose.set('bufferTimeoutMS', 30000);

    console.log("🔄 Connecting to MongoDB...");
    console.log("MONGO_URI exists:", !!process.env.MONGO_URI);
    console.log("MONGO_URI prefix:", process.env.MONGO_URI?.substring(0, 30) + "...");

    const connection = await mongoose.connect(process.env.MONGO_URI, options);

    cachedConnection = connection;
    console.log("✅ MongoDB Connected Successfully");

    // Automatically drop legacy unique index on contactno if present
    try {
      const memberCol = mongoose.connection.db.collection('member_tbl');
      const indexes = await memberCol.indexes();
      const contactIndex = indexes.find(idx => idx.name === 'contactno_1');
      if (contactIndex && contactIndex.unique) {
        await memberCol.dropIndex('contactno_1');
        console.log("ℹ️ Dropped legacy unique index 'contactno_1' from member_tbl to allow duplicate phone numbers");
      }
    } catch (idxErr) {
      // Ignore if collection doesn't exist or index already dropped
    }

    // Connection event listeners
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
      cachedConnection = null;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      cachedConnection = null;
    });

    return connection;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    cachedConnection = null;
    throw error;
  }
};

// Export the connection function
module.exports = connectDB;