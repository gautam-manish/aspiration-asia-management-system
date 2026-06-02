import mongoose from "mongoose";
import dns from "dns";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const connectDB = async () => {
  // Force Node to use Google DNS for resolving the MongoDB SRV record
  dns.setServers(['8.8.8.8', '8.8.4.4']);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10_000, // fail after 10s if no server found
        connectTimeoutMS: 10_000,         // fail after 10s on initial connection
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return; // success — exit the loop
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s…`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error("All MongoDB connection attempts exhausted. Exiting.");
        process.exit(1);
      }
    }
  }
};

export default connectDB;