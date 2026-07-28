import { z } from "zod";

const optionalText = (maximum = 1000) => z.string().trim().max(maximum).optional();
const requiredText = (message: string, maximum = 300) => z.string().trim().min(1, message).max(maximum);

export const businessSupplyInquirySchema = z.object({
  inquiry_type: z.enum(["bulk_business_supply", "export_supply"], { message: "Choose an enquiry type." }),
  company_name: requiredText("Enter your company or business name.", 200),
  contact_person: requiredText("Enter a contact person.", 160),
  email: z.string().trim().email("Enter a valid business email.").max(254),
  phone: requiredText("Enter a phone or WhatsApp number.", 40),
  company_website: optionalText(300),
  country: requiredText("Enter your country.", 120),
  city_state: requiredText("Enter your city or state.", 160),
  products_required: requiredText("Tell us which products you require.", 1000),
  approximate_quantity: requiredText("Enter an approximate quantity and unit.", 300),
  requirement_pattern: requiredText("Choose whether this is one-time or recurring.", 80),
  preferred_date: optionalText(40),
  quality_packaging: optionalText(1000),
  additional_information: optionalText(3000),
  delivery_location: optionalText(500),
  preferred_frequency: optionalText(100),
  procurement_challenge: optionalText(1000),
  destination_country: optionalText(120),
  destination_city: optionalText(160),
  destination_port: optionalText(200),
  product_grade: optionalText(500),
  preferred_packaging: optionalText(500),
  certifications_requirements: optionalText(1500),
  preferred_incoterm: optionalText(100),
  expected_order_frequency: optionalText(200),
  payment_expectation: optionalText(1000),
  acknowledgement: z.literal("yes", { message: "Confirm that this is an enquiry, not an order or quotation." }),
  website: z.string().max(0, "Spam submission rejected."),
  attribution: optionalText(3000),
}).superRefine((value, context) => {
  const requireFor = (name: keyof typeof value, message: string) => {
    if (!String(value[name] ?? "").trim()) context.addIssue({ code: "custom", path: [name], message });
  };
  if (value.inquiry_type === "bulk_business_supply") {
    requireFor("delivery_location", "Enter the delivery location.");
    requireFor("preferred_frequency", "Choose a preferred frequency.");
  } else {
    requireFor("destination_country", "Enter the destination country.");
    requireFor("destination_city", "Enter the destination city.");
    requireFor("expected_order_frequency", "Enter the expected order frequency.");
  }
});

export type BusinessSupplyInquiry = z.infer<typeof businessSupplyInquirySchema>;

export const businessInquiryFieldNames = [
  "inquiry_type", "company_name", "contact_person", "email", "phone", "company_website",
  "country", "city_state", "products_required", "approximate_quantity", "requirement_pattern",
  "preferred_date", "quality_packaging", "additional_information", "delivery_location",
  "preferred_frequency", "procurement_challenge", "destination_country", "destination_city",
  "destination_port", "product_grade", "preferred_packaging", "certifications_requirements",
  "preferred_incoterm", "expected_order_frequency", "payment_expectation", "acknowledgement",
  "website", "attribution",
] as const;

export function inquiryDetails(value: BusinessSupplyInquiry) {
  const { inquiry_type: _type, company_name: _company, contact_person: _contact, email: _email, phone: _phone, website: _honeypot, acknowledgement: _ack, ...details } = value;
  void _type; void _company; void _contact; void _email; void _phone; void _honeypot; void _ack;
  return Object.fromEntries(Object.entries(details).filter(([, item]) => item));
}

