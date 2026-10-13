"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, LoaderCircle, Save, UserRound } from "lucide-react";

type ProfileFormValues = {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  occupation: string;
  phone: string;
  drivingLicenceNumber: string;
  licenceType: string;
  licenceHeldFor: string;
  lastFourDigits: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    county: string;
    postcode: string;
    country: "GB";
  };
};

const titles = ["Mr", "Mrs", "Miss", "Ms", "Mx"];
const genders = ["Male", "Female", "Other", "Prefer not to say"];
const licenceTypes = ["Full UK", "Provisional UK", "International", "Full EU"];
const licenceDurations = ["Under 1 Year", "1-2 Years", "2-4 Years", "5-10 Years", "10+ Years"];

export function ProfileForm({ initialProfile }: { initialProfile: ProfileFormValues }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({ defaultValues: initialProfile });

  async function save(values: ProfileFormValues) {
    setMessage("");
    setError("");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Unable to save your profile.");
      return;
    }
    setMessage("Your details have been saved and will pre-fill your next quote.");
  }

  return (
    <section className="panel mt-6 rounded-[26px] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
          <UserRound size={20} />
        </span>
        <div>
          <h2 className="text-xl font-black">Personal details</h2>
          <p className="mt-1 text-sm text-slate-500">These details are shared with your Cuvva customer account and pre-fill future quotes.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(save)} className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={errors.title?.message}>
          <select className="field" {...register("title", { required: "Select a title" })}>
            <option value="">Select title</option>
            {titles.map((value) => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Gender" error={errors.gender?.message}>
          <select className="field" {...register("gender", { required: "Select a gender" })}>
            <option value="">Select gender</option>
            {genders.map((value) => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="First name" error={errors.firstName?.message}>
          <input className="field" autoComplete="given-name" {...register("firstName", { required: "First name is required" })} />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <input className="field" autoComplete="family-name" {...register("lastName", { required: "Last name is required" })} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" className="field" autoComplete="email" {...register("email", { required: "Email is required" })} />
        </Field>
        <Field label="Mobile number" error={errors.phone?.message}>
          <input className="field" inputMode="numeric" autoComplete="tel" {...register("phone", { required: "Mobile number is required", pattern: { value: /^\d{7,15}$/, message: "Enter 7 to 15 digits" } })} />
        </Field>
        <Field label="Date of birth" error={errors.dateOfBirth?.message}>
          <input type="date" className="field" autoComplete="bday" {...register("dateOfBirth", { required: "Date of birth is required" })} />
        </Field>
        <Field label="Occupation" error={errors.occupation?.message}>
          <input className="field" {...register("occupation", { required: "Occupation is required" })} />
        </Field>
        <Field label="Driving licence number" error={errors.drivingLicenceNumber?.message}>
          <input className="field uppercase" {...register("drivingLicenceNumber", { required: "Driving licence number is required", minLength: { value: 8, message: "Enter at least 8 characters" } })} />
        </Field>
        <Field label="Last four payment-card digits (optional)" error={errors.lastFourDigits?.message}>
          <input className="field" inputMode="numeric" maxLength={4} placeholder="0000" {...register("lastFourDigits", { pattern: { value: /^$|^\d{4}$/, message: "Enter exactly four digits or leave blank" } })} />
        </Field>
        <Field label="Licence type" error={errors.licenceType?.message}>
          <select className="field" {...register("licenceType", { required: "Select a licence type" })}>
            <option value="">Select licence type</option>
            {licenceTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Licence held for" error={errors.licenceHeldFor?.message}>
          <select className="field" {...register("licenceHeldFor", { required: "Select the licence history" })}>
            <option value="">Select licence history</option>
            {licenceDurations.map((value) => <option key={value}>{value}</option>)}
          </select>
        </Field>

        <div className="sm:col-span-2 mt-2 border-t border-white/8 pt-5 text-sm font-extrabold">Residential address</div>
        <div className="sm:col-span-2">
          <Field label="Address line 1" error={errors.address?.line1?.message}>
            <input className="field" autoComplete="address-line1" {...register("address.line1", { required: "Address line 1 is required" })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Address line 2 (optional)" error={errors.address?.line2?.message}>
            <input className="field" autoComplete="address-line2" {...register("address.line2")} />
          </Field>
        </div>
        <Field label="City / town" error={errors.address?.city?.message}>
          <input className="field" autoComplete="address-level2" {...register("address.city", { required: "City is required" })} />
        </Field>
        <Field label="County (optional)" error={errors.address?.county?.message}>
          <input className="field" autoComplete="address-level1" {...register("address.county")} />
        </Field>
        <Field label="Postcode" error={errors.address?.postcode?.message}>
          <input className="field uppercase" autoComplete="postal-code" {...register("address.postcode", { required: "Postcode is required" })} />
        </Field>
        <Field label="Country">
          <input className="field" readOnly aria-readonly="true" {...register("address.country")} />
        </Field>

        <div className="sm:col-span-2">
          {error && <div className="error-box mb-4">{error}</div>}
          {message && <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 size={17} />{message}</div>}
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto">
            {isSubmitting ? <><LoaderCircle size={18} className="animate-spin" /> Saving</> : <><Save size={17} /> Save personal details</>}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-400">{error}</span>}</label>;
}
