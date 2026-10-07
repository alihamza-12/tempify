import { ContentPage } from "@/components/layout/ContentPage";
export default function TermsPage() { return <ContentPage title="Terms of Service" intro="These terms describe the basis on which the Tempify website and quoting journey are provided." sections={[
  { title: "Accurate information", body: "You must provide complete and accurate information. Vehicle details returned by a provider should be checked before continuing." },
  { title: "Quotes and availability", body: "A quote is time-limited and does not create cover. Cover cannot be backdated. A service is fulfilled only after successful payment verification and any required eligibility checks." },
  { title: "Payments", body: "Eligible payment methods are determined by the hosted payment provider and can vary by amount, device, region and availability. Tempify does not store card numbers." },
  { title: "Acceptable use", body: "You must not use the service to create misleading records, misrepresent insurance or cover, commit fraud, interfere with the service, or access another person’s account." },
]} />; }
