import mongoose from "mongoose";
import dns from "dns";

const connectDB = async () => {
  try {
    // Force Node to use Google DNS for resolving the MongoDB SRV record
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;