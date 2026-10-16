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
  PoundSterling,
} from "lucide-react";
import { SectionCard } from "./SectionCard";
import type { VehicleResult } from "@/modules/vehicles/types";

type FormValues = {
  title: "" | "Mr" | "Mrs" | "Miss" | "Ms" | "Mx";
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "" | "Male" | "Female" | "Other" | "Prefer not to say";
  occupation: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  lastFourDigits: string;
  licenceNumber: string;
  licenceType: "" | "Full UK" | "Provisional UK" | "International" | "Full EU";
  heldFor: "" | "Under 1 Year" | "1-2 Years" | "2-4 Years" | "5-10 Years" | "10+ Years";
  vehicleValue: "" | "£1,000 - £5,000" | "£5,000 - £10,000" | "£10,000 - £20,000" | "£20,000 - £30,000" | "£30,000 - £50,000" | "£50,000 - £80,000" | "£80,000+";
  reasonForCover: "" | "Borrowing" | "Buying/Selling/Testing" | "Learning" | "Maintenance" | "Other";
};

const occupations = ["Accountant", "Architect", "Builder", "Business Owner", "Carer", "Chef", "Civil Servant", "Consultant", "Delivery Driver", "Designer", "Doctor", "Electrician", "Engineer", "Mechanic", "Nurse", "Office Manager", "Retail Worker", "Software Developer", "Student", "Teacher"];
const modifications = [
  ["alloy-wheels", "Alloy wheels (aftermarket)"],
  ["wheel-size", "Changing wheel size"],
  ["performance-tyres", "Performance tyres"],
  ["run-flat-conversion", "Run-flat conversion"],
  ["roof-racks", "Roof racks"],
  ["window-tints", "Window tints"],
  ["custom-plates", "Custom 3D/4D plates"],
];

function localDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function capitalizeWords(value: string) {
  return value.replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

type CapitalizedField = "firstName" | "lastName" | "occupation" | "line1" | "line2" | "city" | "county";

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
  const [scheduledStart, setScheduledStart] = useState(localDateTimeValue());
  const [selectedModifications, setSelectedModifications] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dynamic pricing from Cuvva super admin dashboard
  const [dynamicDurationOptions, setDynamicDurationOptions] = useState<{ hours: number[]; days: number[]; weeks: number[] }>({
    hours: [1, 3, 5, 12, 24],
    days: [1, 2, 3, 4, 5, 6, 7],
    weeks: [1, 2, 3, 4],
  });
  const [pricingPreview, setPricingPreview] = useState<null | {
    amount: number;
    category: "past" | "present" | "future";
    fromDatabase: boolean;
    currency: string;
  }>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      title: "",
      gender: "",
      licenceType: "",
      heldFor: "",
      vehicleValue: "",
      reasonForCover: "",
      lastFourDigits: "",
    },
  });

  function updateCapitalizedField(field: CapitalizedField, value: string) {
    setValue(field, capitalizeWords(value), {
      shouldDirty: true,
      shouldValidate: Boolean(errors[field]),
    });
  }

  function updatePhone(value: string) {
    setValue("phone", digitsOnly(value), {
      shouldDirty: true,
      shouldValidate: Boolean(errors.phone),
    });
  }

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        const profile = data?.profile;
        if (!profile) return;
        reset({
          title: profile.title || "",
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          dateOfBirth: profile.dateOfBirth || "",
          gender: profile.gender || "",
          occupation: profile.occupation || "",
          phone: profile.phone || "",
          email: profile.email || "",
          line1: profile.address?.line1 || "",
          line2: profile.address?.line2 || "",
          city: profile.address?.city || "",
          county: profile.address?.county || "",
          postcode: profile.address?.postcode || "",
          lastFourDigits: profile.lastFourDigits || "",
          licenceNumber: profile.drivingLicenceNumber || "",
          licenceType: profile.licenceType || "",
          heldFor: profile.licenceHeldFor || "",
          vehicleValue: "",
          reasonForCover: "",
        });
      })
      .catch(() => undefined);
  }, [reset]);

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

  // Fetch dynamic duration options from Cuvva super admin pricing config
  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (data?.durationOptions) {
          setDynamicDurationOptions({
            hours: data.durationOptions.hours?.length ? data.durationOptions.hours : [1, 3, 5, 12, 24],
            days: data.durationOptions.days?.length ? data.durationOptions.days : [1, 2, 3, 4, 5, 6, 7],
            weeks: data.durationOptions.weeks?.length ? data.durationOptions.weeks : [1, 2, 3, 4],
          });
        }
      })
      .catch(() => {});
  }, []);

  const durationOptions = useMemo(() => {
    return dynamicDurationOptions[durationUnit] || [1, 3, 5, 12, 24];
  }, [durationUnit, dynamicDurationOptions]);

  // Ensure selected durationValue exists in current options, if not pick first
  // Fixed to avoid react-hooks/set-state-in-effect: schedule update via setTimeout callback
  useEffect(() => {
    if (!durationOptions.includes(durationValue)) {
      const nextValue = durationOptions[0] || 1;
      const timeoutId = setTimeout(() => {
        setDurationValue(nextValue);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [durationOptions, durationValue]);

  // Dynamic pricing preview - fetch from DB when duration or start time changes
  // Fixed to avoid react-hooks/set-state-in-effect: loading state set via callback
  useEffect(() => {
    const startAt = startMode === "immediate" ? new Date() : new Date(scheduledStart);
    if (Number.isNaN(startAt.getTime())) return;

    const controller = new AbortController();
    const loadingTimeout = setTimeout(() => {
      setLoadingPricing(true);
    }, 0);
    fetch("/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationUnit,
        durationValue,
        startAt: startAt.toISOString(),
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (data?.pricing) {
          setPricingPreview({
            amount: data.pricing.amount,
            category: data.category || data.pricing.category || "present",
            fromDatabase: data.pricing.fromDatabase ?? false,
            currency: data.pricing.currency || "GBP",
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(loadingTimeout);
        setLoadingPricing(false);
      });

    return () => {
      clearTimeout(loadingTimeout);
      controller.abort();
    };
  }, [durationUnit, durationValue, startMode, scheduledStart]);

  async function submit(values: FormValues) {
    if (!vehicle) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const startAt = startMode === "immediate" ? new Date() : new Date(scheduledStart);
      if (Number.isNaN(startAt.getTime())) {
        throw new Error("Choose a valid start date and time.");
      }

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: vehicle.registration,
          cover: { durationUnit, durationValue, startAt: startAt.toISOString() },
          driver: {
            title: values.title,
            firstName: capitalizeWords(values.firstName.trim()),
            lastName: capitalizeWords(values.lastName.trim()),
            dateOfBirth: values.dateOfBirth,
            gender: values.gender,
            occupation: capitalizeWords(values.occupation.trim()),
            phone: digitsOnly(values.phone),
            email: values.email.trim().toLowerCase(),
          },
          address: {
            line1: capitalizeWords(values.line1.trim()),
            line2: capitalizeWords((values.line2 || "").trim()),
            city: capitalizeWords(values.city.trim()),
            county: capitalizeWords((values.county || "").trim()),
            postcode: values.postcode.trim().toUpperCase(),
          },
          licence: {
            number: values.licenceNumber,
            lastFourDigits: values.lastFourDigits,
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

  function handleInvalidSubmission() {
    setSubmitError("Please check the highlighted fields and enter valid details before continuing.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit, handleInvalidSubmission)} className="space-y-4">
      {submitError && <div className="error-box">{submitError}</div>}

      <SectionCard icon={CarFront} title="Vehicle details" accent="emerald">
        {loadingVehicle ? (
          <div className="flex items-center gap-3 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin text-violet-400" /> Verifying your vehicle…</div>
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
            <button key={unit} type="button" onClick={() => { setDurationUnit(unit); }} className={`min-h-11 rounded-xl border text-sm font-bold capitalize transition ${durationUnit === unit ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-600/20" : "border-white/8 bg-[#1a2536] text-slate-400 hover:text-white"}`}>{unit}</button>
          ))}
        </div>
        <div className="mt-5">
          <FieldLabel text="How long?" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {durationOptions.map((value) => <button key={value} type="button" onClick={() => setDurationValue(value)} className={`min-h-11 rounded-xl border text-sm font-bold transition ${durationValue === value ? "border-violet-500 bg-violet-500/15 text-violet-300" : "border-white/8 bg-[#1a2536] text-slate-400 hover:text-white"}`}>{value} {value === 1 ? durationUnit.slice(0, -1) : durationUnit}</button>)}
          </div>
          <p className="mt-2 text-[10px] text-[#8a8fbc]">Options managed by super admin: {durationOptions.join(", ")} {durationUnit}</p>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><FieldLabel text="Start option" /><select className="field" value={startMode} onChange={(event) => setStartMode(event.target.value as "immediate" | "scheduled")}><option value="immediate">Immediate start</option><option value="scheduled">Choose date & time</option></select></label>
          <label className={startMode === "immediate" ? "opacity-45" : ""}><FieldLabel text="Start date & time" /><input type="datetime-local" className="field" disabled={startMode === "immediate"} value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} /></label>
        </div>
        <p className="mt-4 text-xs text-slate-500">Previous dates and times can be selected. Past starts receive a higher price calculated securely on the server. Pricing is dynamic from super admin database.</p>

        {/* Dynamic Pricing Preview from Database */}
        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#5e4bff]/10 to-[#8b5cf6]/10 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-violet-300 uppercase tracking-wider">
            <PoundSterling size={14} /> Total price preview
            {pricingPreview?.category && <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${pricingPreview.category === "past" ? "bg-amber-500/15 text-amber-300" : pricingPreview.category === "future" ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300"}`}>{pricingPreview.category}</span>}
          </div>
          <div className="mt-3">
            {loadingPricing ? (
              <div className="flex items-center gap-2 text-sm text-slate-400"><LoaderCircle size={16} className="animate-spin" /> Calculating price from database...</div>
            ) : pricingPreview ? (
              <>
                <div className="text-3xl font-black text-white">£{pricingPreview.amount.toFixed(2)}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {pricingPreview.fromDatabase ? "✓ From super admin database" : "Fallback pricing"} • {durationValue} {durationUnit} • {pricingPreview.category} • {startMode === "immediate" ? "Immediate start" : new Date(scheduledStart).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Select duration to see price</div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={UserRound} title="Driver details">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Title" error={errors.title?.message}><select className="field" {...register("title", { required: "Select a title" })}><option value="" disabled>Select title</option>{["Mr", "Mrs", "Miss", "Ms", "Mx"].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
          <FormField label="First name" error={errors.firstName?.message}>
            <input className="field" autoComplete="given-name" {...register("firstName", { required: "First name is required", minLength: { value: 2, message: "Enter at least 2 characters" }, maxLength: { value: 60, message: "Enter no more than 60 characters" } })} onChange={(event) => updateCapitalizedField("firstName", event.target.value)} />
          </FormField>
          <FormField label="Last name" error={errors.lastName?.message}>
            <input className="field" autoComplete="family-name" {...register("lastName", { required: "Last name is required", minLength: { value: 2, message: "Enter at least 2 characters" }, maxLength: { value: 60, message: "Enter no more than 60 characters" } })} onChange={(event) => updateCapitalizedField("lastName", event.target.value)} />
          </FormField>
          <FormField label="Date of birth" error={errors.dateOfBirth?.message}><input type="date" className="field" autoComplete="bday" {...register("dateOfBirth", { required: "Date of birth is required" })} /></FormField>
          <FormField label="Gender" error={errors.gender?.message}><select className="field" {...register("gender", { required: "Select a gender" })}><option value="" disabled>Select gender</option>{["Male", "Female", "Other", "Prefer not to say"].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
          <FormField label="Occupation" error={errors.occupation?.message}>
            <input className="field" list="occupations" placeholder="Search occupation…" autoComplete="organization-title" {...register("occupation", { required: "Occupation is required", minLength: { value: 2, message: "Enter at least 2 characters" }, maxLength: { value: 100, message: "Enter no more than 100 characters" } })} onChange={(event) => updateCapitalizedField("occupation", event.target.value)} />
            <datalist id="occupations">{occupations.map((item) => <option key={item} value={item} />)}</datalist>
          </FormField>
          <FormField label="Phone number" error={errors.phone?.message}>
            <input type="tel" className="field" inputMode="numeric" autoComplete="tel" maxLength={15} placeholder="07123456789" {...register("phone", { required: "Phone number is required", pattern: { value: /^[0-9]{7,15}$/, message: "Enter 7 to 15 digits only" } })} onChange={(event) => updatePhone(event.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Email address" error={errors.email?.message}>
              <input type="email" className="field" inputMode="email" autoComplete="email" maxLength={254} placeholder="you@example.com" {...register("email", { required: "Email is required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: "Enter a valid email address" }, setValueAs: (value) => String(value || "").trim().toLowerCase() })} />
            </FormField>
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={MapPin} title="Address information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Address line 1" error={errors.line1?.message}>
              <input className="field" autoComplete="address-line1" {...register("line1", { required: "Address is required", minLength: { value: 3, message: "Enter at least 3 characters" }, maxLength: { value: 120, message: "Enter no more than 120 characters" } })} onChange={(event) => updateCapitalizedField("line1", event.target.value)} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Address line 2 (optional)" error={errors.line2?.message}>
              <input className="field" autoComplete="address-line2" {...register("line2", { maxLength: { value: 120, message: "Enter no more than 120 characters" } })} onChange={(event) => updateCapitalizedField("line2", event.target.value)} />
            </FormField>
          </div>
          <FormField label="City / town" error={errors.city?.message}>
            <input className="field" autoComplete="address-level2" {...register("city", { required: "City is required", minLength: { value: 2, message: "Enter at least 2 characters" }, maxLength: { value: 80, message: "Enter no more than 80 characters" } })} onChange={(event) => updateCapitalizedField("city", event.target.value)} />
          </FormField>
          <FormField label="County (optional)" error={errors.county?.message}>
            <input className="field" autoComplete="address-level1" {...register("county", { maxLength: { value: 80, message: "Enter no more than 80 characters" } })} onChange={(event) => updateCapitalizedField("county", event.target.value)} />
          </FormField>
          <FormField label="Postcode" error={errors.postcode?.message}>
            <input className="field uppercase" autoComplete="postal-code" maxLength={10} placeholder="SW1A 1AA" {...register("postcode", { required: "Postcode is required", minLength: { value: 5, message: "Enter a valid postcode" }, maxLength: { value: 10, message: "Enter a valid postcode" }, setValueAs: (value) => String(value || "").trim().toUpperCase() })} />
          </FormField>
          <FormField label="Country"><input className="field" value="GB" readOnly /></FormField>
        </div>
      </SectionCard>

      <SectionCard icon={CreditCard} title="Licence & vehicle">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Driving licence number" error={errors.licenceNumber?.message}><input className="field uppercase" autoComplete="off" maxLength={24} {...register("licenceNumber", { required: "Licence number is required", minLength: { value: 8, message: "Enter at least 8 characters" }, maxLength: { value: 24, message: "Enter no more than 24 characters" }, setValueAs: (value) => String(value || "").trim().toUpperCase() })} /></FormField>
          <FormField label="Last four payment-card digits (optional)" error={errors.lastFourDigits?.message}><input className="field" inputMode="numeric" maxLength={4} placeholder="0000" {...register("lastFourDigits", { pattern: { value: /^$|^\d{4}$/, message: "Enter exactly four digits or leave blank" }, setValueAs: (value) => String(value || "").replace(/\D/g, "").slice(0, 4) })} /></FormField>
          <FormField label="Licence type" error={errors.licenceType?.message}><select className="field" {...register("licenceType", { required: "Select a licence type" })}><option value="" disabled>Select licence type</option>{["Full UK", "Provisional UK", "International", "Full EU"].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
          <FormField label="Licence held for" error={errors.heldFor?.message}><select className="field" {...register("heldFor", { required: "Select how long the licence has been held" })}><option value="" disabled>Select licence history</option>{["Under 1 Year", "1-2 Years", "2-4 Years", "5-10 Years", "10+ Years"].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
          <FormField label="Vehicle value" error={errors.vehicleValue?.message}><select className="field" {...register("vehicleValue", { required: "Select the vehicle value" })}><option value="" disabled>Select vehicle value</option>{["£1,000 - £5,000", "£5,000 - £10,000", "£10,000 - £20,000", "£20,000 - £30,000", "£30,000 - £50,000", "£50,000 - £80,000", "£80,000+"].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField>
          <div className="sm:col-span-2"><FormField label="Reason for cover" error={errors.reasonForCover?.message}><select className="field" {...register("reasonForCover", { required: "Select a reason for cover" })}><option value="" disabled>Select reason for cover</option>{["Borrowing", "Buying/Selling/Testing", "Learning", "Maintenance", "Other"].map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField></div>
        </div>
      </SectionCard>

      <SectionCard icon={SlidersHorizontal} title="Vehicle modifications" accent="purple">
        <div className="mb-5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-300">Tell us about any applicable modifications.</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {modifications.map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-[#172233] px-4 py-3 text-sm text-slate-300 hover:border-white/20">
              <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={selectedModifications.includes(value)} onChange={(event) => setSelectedModifications((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{label}
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
