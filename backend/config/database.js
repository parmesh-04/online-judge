const mongoose = require('mongoose')

let connectionPromise = null;

const DBConnection = async() =>{
const MONGO_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

try{
if (connectionPromise) return connectionPromise;

connectionPromise = mongoose.connect(MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
});

const conn = await connectionPromise
console.log("db connection established successfully")
return conn
}
catch(error){
     console.error("❌ Error while connecting to MongoDB:", error.message);
     throw error;
}
}

const connectDB = DBConnection;

module.exports = { DBConnection, connectDB };
