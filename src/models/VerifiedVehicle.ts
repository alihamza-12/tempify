import { Schema, model, models } from "mongoose";

const verifiedVehicleSchema = new Schema(
  {
    registration: { type: String, required: true, unique: true, uppercase: true, trim: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    description: String,
    colour: String,
    year: Number,
    fuelType: String,
    engineCapacityCC: Number,
    bodyStyle: String,
    variant: String,
    transmission: String,
    numberOfDoors: Number,
    numberOfSeats: Number,
    vehicleInsuranceGroup: Number,
    vehicleInsuranceGroupOutOf: Number,
    abiCode: String,
    imageUrl: String,
    source: { type: String, enum: ["regcheck"], required: true },
    verified: { type: Boolean, default: true, required: true },
    verifiedAt: { type: Date, required: true },
    providerPayload: { type: Schema.Types.Mixed, required: true },
    cuvvaSynced: { type: Boolean, default: false, required: true },
    cuvvaSyncedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "tempify_verified_vehicles" },
);

verifiedVehicleSchema.index({ registration: 1, verified: 1, source: 1 });

export const VerifiedVehicle =
  models.VerifiedVehicle || model("VerifiedVehicle", verifiedVehicleSchema);
