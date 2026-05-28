import mongoose from "mongoose";

const costPerRoomSchema = new mongoose.Schema(
  {
    mealPlan: {
      type: String,
      enum: ["EP", "CP", "MAP", "AP", "JP"],
      required: [true, "Meal plan is required"],
    },
    roomCategory: {
      type: String,
      trim: true,
      default: "",
    },
    roomType: {
      type: String,
      enum: ["Single", "Double", "Triple", "Quad", ""],
      default: "",
    },
    inrRate: {
      type: Number,
      required: [true, "INR Rate is required"],
      min: [0, "INR Rate cannot be negative"],
    },
    usdRate: {
      type: Number,
      required: [true, "USD Rate is required"],
      min: [0, "USD Rate cannot be negative"],
    },
  },
  { _id: false },
);

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hotel name is required"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    googleMapUrl: {
      type: String,
      trim: true,
      default: "",
    },
    contactNumbers: {
      type: [String],
      default: [],
    },
    costPerRoom: {
      type: [costPerRoomSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one room rate entry is required",
      },
    },
  },
  {
    timestamps: true,
  },
);

const Hotel = mongoose.model("Hotel", hotelSchema);

export default Hotel;
