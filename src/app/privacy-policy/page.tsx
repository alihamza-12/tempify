import { ContentPage } from "@/components/layout/ContentPage";
export default function PrivacyPage() { return <ContentPage title="Privacy Policy" intro="This notice explains how Tempify handles information supplied during account creation, vehicle lookup, quoting and payment." sections={[
  { title: "Information we process", body: "We process account details, contact information, quote details, vehicle registrations and payment-status references. Card information is entered on the payment provider’s hosted checkout and is not stored by Tempify." },
  { title: "How information is used", body: "Information is used to verify accounts, provide quotes, prevent abuse, create payment orders, send service emails and maintain legally required transaction records." },
  { title: "Service providers", body: "The service may use MongoDB for data storage, Resend for transactional email, RegCheck for vehicle verification, Vercel for hosting and PayMeGate for hosted payment processing." },
  { title: "Your choices", body: "Contact the business to request access, correction or deletion where the applicable law permits. Financial and transaction records may need to be retained for legal, tax or dispute purposes." },
]} />; }
