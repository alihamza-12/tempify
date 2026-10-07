"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CarFront,
  CreditCard,
  LoaderCircle,
  MapPin,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { SectionCard } from "./SectionCard";
import type { VehicleResult } from "@/modules/vehicles/types";

type FormValues = {
  title: "Mr" | "Mrs" | "Miss" | "Ms" | "Mx";
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  occupation: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  licenceNumber: string;
  licenceType: "Full UK" | "Provisional UK" | "International" | "Full EU";
  heldFor: "Under 1 Year" | "1-2 Years" | "2-4 Years" | "5-10 Years" | "10+ Years";
  vehicleValue: "£1,000 - £5,000" | "£5,000 - £10,000" | "£10,000 - £20,000" | "£20,000 - £30,000" | "£30,000 - £50,000" | "£50,000 - £80,000" | "£80,000+";
  reasonForCover: "Borrowing" | "Buying/Selling/Testing" | "Learning" | "Maintenance" | "Other";
};

const occupations = ["Accountant", "Architect", "Builder", "Business owner", "Carer", "Chef", "Civil servant", "Consultant", "Delivery driver", "Designer", "Doctor", "Electrician", "Engineer", "Mechanic", "Nurse", "Office manager", "Retail worker", "Software developer", "Student", "Teacher"];
const modifications = [
  ["alloy-wheels", "Alloy wheels (aftermarket)"],
  ["wheel-size", "Changing wheel size"],
  ["performance-tyres", "Performance tyres"],
  ["run-flat-conversion", "Run-flat conversion"],
  ["roof-racks", "Roof racks"],
  ["window-tints", "Window tints"],
  ["custom-plates", "Custom 3D/4D plates"],
];

function localDateTimeMinimum() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 2);
  return now.toISOString().slice(0, 16);
}

export function QuoteForm({ registration }: { registration: string }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<VehicleResult | null>(null);
  const [vehicleError, setVehicleError] = useState(
    registration ? "" : "No vehicle registration was provided.",
  );
  const [loadingVehicle, setLoadingVehicle] = useState(Boolean(registration));
  const [durationUnit, setDurationUnit] = useState<"hours" | "days" | "weeks">("hours");
  const [durationValue, setDurationValue] = useState(1);
  const [startMode, setStartMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledStart, setScheduledStart] = useState(localDateTimeMinimum());
  const [selectedModifications, setSelectedModifications] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: "Mr",
      licenceType: "Full UK",
      heldFor: "1-2 Years",
      vehicleValue: "£5,000 - £10,000",
      reasonForCover: "Borrowing",
    },
  });

  useEffect(() => {
    if (!registration) return;
    fetch(`/api/vehicles/lookup?registration=${encodeURIComponent(registration)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Vehicle lookup failed.");
        setVehicle(data.vehicle);
      })
      .catch((error) => setVehicleError(error.message))
      .finally(() => setLoadingVehicle(false));
  }, [registration]);

  const durationOptions = useMemo(() => {
    if (durationUnit === "hours") return [1, 3, 5, 12, 24];
    if (durationUnit === "days") return [1, 2, 3, 5, 7];
    return [1, 2, 3, 4];
  }, [durationUnit]);

  async function submit(values: FormValues) {
    if (!vehicle) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const startAt = startMode === "immediate" ? new Date() : new Date(scheduledStart);
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: vehicle.registration,
          cover: { durationUnit, durationValue, startAt: startAt.toISOString() },
          driver: {
            title: values.title,
            firstName: values.firstName,
            lastName: values.lastName,
            dateOfBirth: values.dateOfBirth,
            occupation: values.occupation,
            phone: values.phone,
            email: values.email,
          },
          address: {
            line1: values.line1,
            line2: values.line2,
            city: values.city,
            postcode: values.postcode,
          },
          licence: {
            number: values.licenceNumber,
            type: values.licenceType,
            heldFor: values.heldFor,
            vehicleValue: values.vehicleValue,
            reasonForCover: values.reasonForCover,
          },
          modifications: selectedModifications,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save your quote.");
      router.push(`/review?id=${encodeURIComponent(data.publicId)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save your quote.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {submitError && <div className="error-box">{submitError}</div>}

      <SectionCard icon={CarFront} title="Vehicle details" accent="emerald">
        {loadingVehicle ? (
          <div className="flex items-center gap-3 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin text-orange-400" /> Verifying your vehicle…</div>
        ) : vehicleError ? (
          <div className="error-box">{vehicleError}</div>
        ) : vehicle ? (
          <div className="grid gap-4 sm:grid-cols-4">
            <VehicleStat label="Registration" value={vehicle.registration} plate />
            <VehicleStat label="Make" value={vehicle.make} />
            <VehicleStat label="Model" value={vehicle.model} />
            <VehicleStat label="Year" value={vehicle.year ? String(vehicle.year) : "—"} />
            <div className="sm:col-span-4 flex items-center gap-2 border-t border-white/8 pt-4 text-xs font-bold text-emerald-400"><BadgeCheck size={15} /> Verified using the vehicle data provider</div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard icon={CalendarClock} title="Duration & timing">
        <FieldLabel text="Duration type" />
        <div className="grid grid-cols-3 gap-2">
          {(["hours", "days", "weeks"] as const).map((unit) => (
            <button key={unit} type="button" onClick={() => { setDurationUnit(unit); setDurationValue(1); }} className={`min-h-11 rounded-xl border text-sm font-bold capitalize transition ${durationUnit === unit ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-600/20" : "border-white/8 bg-[#1a2536] text-slate-400 hover:text-white"}`}>{unit}</button>
          ))}
        </div>
        <div className="mt-5">
          <FieldLabel text="How long?" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {durationOptions.map((value) => <button key={value} type="button" onClick={() => setDurationValue(value)} className={`min-h-11 rounded-xl border text-sm font-bold transition ${durationValue === value ? "border-orange-500 bg-orange-500/15 text-orange-300" : "border-white/8 bg-[#1a2536] text-slate-400 hover:text-white"}`}>{value} {value === 1 ? durationUnit.slice(0, -1) : durationUnit}</button>)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><FieldLabel text="Start option" /><select className="field" value={startMode} onChange={(event) => setStartMode(event.target.value as "immediate" | "scheduled")}><option value="immediate">Immediate start</option><option value="scheduled">Schedule a future time</option></select></label>
          <label className={startMode === "immediate" ? "opacity-45" : ""}><FieldLabel text="Start date & time" /><input type="datetime-local" className="field" min={localDateTimeMinimum()} disabled={startMode === "immediate"} value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} /></label>
        </div>
        <p className="mt-4 text-xs text-slate-500">Cover can start now or in the future. Backdated cover is not available.</p>
      </SectionCard>

      <SectionCard icon={UserRound} title="Driver details">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Title" error={errors.title?.message}><select className="field" {...register("title", { required: true })}>{["Mr", "Mrs", "Miss", "Ms", "Mx"].map((item) => <option key={item}>{item}</option>)}</select></FormField>
          <FormField label="First name" error={errors.firstName?.message}><input className="field" {...register("firstName", { required: "First name is required" })} /></FormField>
          <FormField label="Last name" error={errors.lastName?.message}><input className="field" {...register("lastName", { required: "Last name is required" })} /></FormField>
          <FormField label="Date of birth" error={errors.dateOfBirth?.message}><input type="date" className="field" {...register("dateOfBirth", { required: "Date of birth is required" })} /></FormField>
          <FormField label="Occupation" error={errors.occupation?.message}><input className="field" list="occupations" placeholder="Search occupation…" {...register("occupation", { required: "Occupation is required" })} /><datalist id="occupations">{occupations.map((item) => <option key={item} value={item} />)}</datalist></FormField>
          <FormField label="Phone number" error={errors.phone?.message}><input className="field" inputMode="tel" placeholder="07123 456789" {...register("phone", { required: "Phone number is required" })} /></FormField>
          <div className="sm:col-span-2"><FormField label="Email address" error={errors.email?.message}><input type="email" className="field" placeholder="you@example.com" {...register("email", { required: "Email is required" })} /></FormField></div>
        </div>
      </SectionCard>

      <SectionCard icon={MapPin} title="Address information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><FormField label="Address line 1" error={errors.line1?.message}><input className="field" {...register("line1", { required: "Address is required" })} /></FormField></div>
          <div className="sm:col-span-2"><FormField label="Address line 2 (optional)"><input className="field" {...register("line2")} /></FormField></div>
          <FormField label="City / town" error={errors.city?.message}><input className="field" {...register("city", { required: "City is required" })} /></FormField>
          <FormField label="Postcode" error={errors.postcode?.message}><input className="field uppercase" placeholder="SW1A 1AA" {...register("postcode", { required: "Postcode is required" })} /></FormField>
        </div>
      </SectionCard>

      <SectionCard icon={CreditCard} title="Licence & vehicle">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Driving licence number" error={errors.licenceNumber?.message}><input className="field uppercase" {...register("licenceNumber", { required: "Licence number is required" })} /></FormField>
          <FormField label="Licence type"><select className="field" {...register("licenceType")}>{["Full UK", "Provisional UK", "International", "Full EU"].map((item) => <option key={item}>{item}</option>)}</select></FormField>
          <FormField label="Licence held for"><select className="field" {...register("heldFor")}>{["Under 1 Year", "1-2 Years", "2-4 Years", "5-10 Years", "10+ Years"].map((item) => <option key={item}>{item}</option>)}</select></FormField>
          <FormField label="Vehicle value"><select className="field" {...register("vehicleValue")}>{["£1,000 - £5,000", "£5,000 - £10,000", "£10,000 - £20,000", "£20,000 - £30,000", "£30,000 - £50,000", "£50,000 - £80,000", "£80,000+"].map((item) => <option key={item}>{item}</option>)}</select></FormField>
          <div className="sm:col-span-2"><FormField label="Reason for cover"><select className="field" {...register("reasonForCover")}>{["Borrowing", "Buying/Selling/Testing", "Learning", "Maintenance", "Other"].map((item) => <option key={item}>{item}</option>)}</select></FormField></div>
        </div>
      </SectionCard>

      <SectionCard icon={SlidersHorizontal} title="Vehicle modifications" accent="purple">
        <div className="mb-5 rounded-xl border border-orange-500/20 bg-orange-500/8 px-4 py-3 text-sm text-orange-300">Tell us about any applicable modifications.</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {modifications.map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-[#172233] px-4 py-3 text-sm text-slate-300 hover:border-white/20">
              <input type="checkbox" className="h-4 w-4 accent-orange-500" checked={selectedModifications.includes(value)} onChange={(event) => setSelectedModifications((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{label}
            </label>
          ))}
        </div>
      </SectionCard>

      <div className="flex justify-center pt-5">
        <button type="submit" disabled={submitting || !vehicle} className="btn-primary w-full max-w-sm">
          {submitting ? <><LoaderCircle size={18} className="animate-spin" /> Saving quote</> : <>Review details <ArrowRight size={18} /></>}
        </button>
      </div>
    </form>
  );
}

function VehicleStat({ label, value, plate = false }: { label: string; value: string; plate?: boolean }) {
  return <div><div className="label">{label}</div><div className={plate ? "inline-flex rounded-md border border-black bg-[#ffd329] px-3 py-2 font-black tracking-wide text-black" : "pt-2 font-extrabold text-white"}>{value}</div></div>;
}

function FieldLabel({ text }: { text: string }) { return <span className="label">{text}</span>; }
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><FieldLabel text={label} />{children}{error && <span className="mt-1.5 block text-xs text-red-400">{error}</span>}</label>;
}
