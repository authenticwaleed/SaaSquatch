import type { DigitalSignals, Lead } from "@/lib/types";

/**
 * Demo dataset shaped like a real SaaSquatch export for an Ohio search.
 *
 * Deliberately messy: it contains duplicate rows, role and consumer mailboxes,
 * a dead domain and a company with no website — so the dashboard demonstrates
 * dedupe, validation and scoring on arrival rather than on a happy path.
 */

type Row = Partial<Lead> & { id: string; companyName: string; sig?: Partial<DigitalSignals> };

const NOW = "2026-09-17T00:00:00.000Z";

const rows: Row[] = [
  // --- Prime targets: old, owner-operated, fragmented, digitally neglected ---
  { id: "1", companyName: "Brennan Heating & Air", website: "https://www.brennanhvac.com", industry: "HVAC",
    city: "Toledo", state: "OH", revenueUsd: 3_200_000, email: "info@brennanhvac.com", phone: "+1 (419) 555-0100",
    sig: { https: true, mobileResponsive: false, copyrightYear: 2015, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: null, socialLinks: 1 } },
  { id: "2", companyName: "Brennan Heating and Air, Inc.", domain: "brennanhvac.com", industry: "HVAC",
    city: "Toledo", state: "OH", ownerName: "Dale Brennan", ownerTitle: "Owner", yearFounded: 1994, phone: "419-555-0100" },
  { id: "3", companyName: "Brennan Heating", industry: "HVAC", city: "Perrysburg", state: "OH",
    employeeCount: 24, phone: "(419) 555-0100" },

  { id: "4", companyName: "Kowalski Plumbing & Drain", website: "https://kowalskiplumbing.com", industry: "Plumbing",
    city: "Cleveland", state: "OH", revenueUsd: 4_100_000, employeeCount: 31, ownerName: "Marta Kowalski",
    ownerTitle: "Owner", yearFounded: 1989, email: "marta@kowalskiplumbing.com", phone: "216-555-0142",
    sig: { https: false, mobileResponsive: false, copyrightYear: 2012, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: null, socialLinks: 0 } },

  { id: "5", companyName: "Valley Precision Machining", website: "https://valleyprecision.com", industry: "Machining",
    city: "Akron", state: "OH", revenueUsd: 8_400_000, employeeCount: 61, ownerName: "Henrik Vasquez",
    ownerTitle: "President", yearFounded: 1987, email: "hvasquez@valleyprecision.com", phone: "330-555-0188",
    sig: { https: true, mobileResponsive: false, copyrightYear: 2019, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: "WordPress", socialLinks: 2 } },

  { id: "6", companyName: "Buckeye Pest Solutions", website: "https://buckeyepest.com", industry: "Pest Control",
    city: "Columbus", state: "OH", revenueUsd: 2_600_000, employeeCount: 19, ownerName: "Ray Tillman",
    ownerTitle: "Founder", yearFounded: 1998, email: "ray@buckeyepest.com", phone: "614-555-0177",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2021, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: "WordPress", socialLinks: 2 } },

  { id: "7", companyName: "Northcoast Roofing Co", website: "https://northcoastroofing.com", industry: "Roofing",
    city: "Cleveland", state: "OH", revenueUsd: 5_900_000, employeeCount: 44, ownerName: "Gus Petrakis",
    ownerTitle: "Owner", yearFounded: 1991, email: "office@northcoastroofing.com", phone: "216-555-0201",
    sig: { https: true, mobileResponsive: false, copyrightYear: 2017, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: true, cms: null, socialLinks: 1 } },

  { id: "8", companyName: "Sandusky Auto & Collision", website: "https://sanduskyautobody.com", industry: "Auto Repair",
    city: "Sandusky", state: "OH", revenueUsd: 3_800_000, employeeCount: 27, ownerName: "Luz Herrera",
    ownerTitle: "Proprietor", yearFounded: 1996, email: "luz@sanduskyautobody.com", phone: "419-555-0233",
    sig: { https: true, mobileResponsive: false, copyrightYear: 2016, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: null, socialLinks: 1 } },

  // --- Strong fit but already modern: Upside collapses, band drops ---
  { id: "9", companyName: "Lakeside Dental Group", website: "https://lakesidedental.com", industry: "Dental",
    city: "Toledo", state: "OH", revenueUsd: 2_100_000, employeeCount: 14, ownerName: "Dr. Iris Vance",
    ownerTitle: "Principal Dentist", yearFounded: 2002, email: "dr.vance@lakesidedental.com", phone: "419-555-0155",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2026, hasOnlineBooking: true, hasChatWidget: true, hasAnalytics: true, cms: "WordPress", socialLinks: 4 } },

  { id: "10", companyName: "Maple & Vine Veterinary", website: "https://mapleandvine.vet", industry: "Veterinary",
    city: "Dublin", state: "OH", revenueUsd: 3_400_000, employeeCount: 22, ownerName: "Dr. Owen Castellanos",
    ownerTitle: "Owner", yearFounded: 2005, email: "owen@mapleandvine.vet", phone: "614-555-0291",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2026, hasOnlineBooking: true, hasChatWidget: false, hasAnalytics: true, cms: "Squarespace", socialLinks: 3 } },

  // --- Mid-range ---
  { id: "11", companyName: "Rivera Commercial Cleaning", website: "https://riveraclean.com", industry: "Commercial Cleaning",
    city: "Dayton", state: "OH", revenueUsd: 1_800_000, employeeCount: 38, ownerName: "Ana Rivera",
    ownerTitle: "Owner", yearFounded: 2009, email: "ana@riveraclean.com", phone: "937-555-0310",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2023, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: "Wix", socialLinks: 2 } },

  { id: "12", companyName: "Hollis Bookkeeping & Tax", website: "https://hollistax.com", industry: "Accounting",
    city: "Cincinnati", state: "OH", revenueUsd: 1_200_000, employeeCount: 11, ownerName: "Pat Hollis",
    ownerTitle: "Principal", yearFounded: 1999, email: "pat@hollistax.com", phone: "513-555-0344",
    sig: { https: true, mobileResponsive: false, copyrightYear: 2018, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: null, socialLinks: 0 } },

  { id: "13", companyName: "Greenfield Landscaping", website: "https://greenfieldlandscape.com", industry: "Landscaping",
    city: "Columbus", state: "OH", revenueUsd: 2_900_000, employeeCount: 33, ownerName: "Tom Osei",
    ownerTitle: "Owner", yearFounded: 2001, email: "info@greenfieldlandscape.com", phone: "614-555-0378",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2024, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: true, cms: "WordPress", socialLinks: 3 } },

  { id: "14", companyName: "Pinnacle Staffing Partners", website: "https://pinnaclestaffing.com", industry: "Staffing",
    city: "Cleveland", state: "OH", revenueUsd: 12_500_000, employeeCount: 78, ownerName: "Dee Ferraro",
    ownerTitle: "Managing Partner", yearFounded: 1993, email: "dferraro@pinnaclestaffing.com", phone: "216-555-0412",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2025, hasOnlineBooking: false, hasChatWidget: true, hasAnalytics: true, cms: "HubSpot CMS", socialLinks: 4 } },

  // --- Data-quality edge cases ---
  { id: "15", companyName: "Corner Barbers", industry: "Salon", city: "Akron", state: "OH",
    revenueUsd: 90_000, employeeCount: 2, ownerName: "Sam Oyelaran", ownerTitle: "Owner", yearFounded: 2021,
    email: "cornerbarbers@gmail.com", phone: "330-555-0455", sig: { hasWebsite: false } },

  { id: "16", companyName: "Ridgeline Security Systems", website: "https://ridgelinesec.example", industry: "Security",
    city: "Toledo", state: "OH", revenueUsd: 4_600_000, employeeCount: 29, ownerName: "Frank Nowak",
    ownerTitle: "Owner", yearFounded: 1990, email: "frank@ridgelinesec.example", phone: "419-555-0488",
    sig: { reachable: false } },

  { id: "17", companyName: "Nimbus AI Labs", website: "https://nimbusai.io", industry: "SaaS Startup",
    city: "Columbus", state: "OH", revenueUsd: 400_000, employeeCount: 6, ownerName: "Rea Okafor",
    ownerTitle: "Co-Founder", yearFounded: 2023, email: "rea@nimbusai.io", phone: "614-555-0501",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2026, hasOnlineBooking: false, hasChatWidget: true, hasAnalytics: true, cms: "Webflow", socialLinks: 3 } },

  { id: "18", companyName: "Quickflip Media", website: "https://quickflipmedia.com", industry: "Advertising Agency",
    city: "Cincinnati", state: "OH", revenueUsd: 850_000, employeeCount: 9, ownerName: "Jo Lindqvist",
    ownerTitle: "Founder", yearFounded: 2019, email: "sales@mailinator.com", phone: "513-555-0522",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2025, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: true, cms: "Squarespace", socialLinks: 2 } },

  { id: "19", companyName: "Harbor Point Physical Therapy", website: "https://harborpointpt.com", industry: "Physical Therapy",
    city: "Cleveland", state: "OH", revenueUsd: 1_650_000, employeeCount: 13, ownerName: "Nadia Brandt",
    ownerTitle: "Owner", yearFounded: 2004, email: "info@harborpointpt.com", phone: "216-555-0549",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2022, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: "WordPress", socialLinks: 1 } },

  { id: "20", companyName: "Buckeye Pest Solutions LLC", domain: "buckeyepest.com", industry: "Pest Control",
    city: "Columbus", state: "OH", revenueUsd: 2_600_000, phone: "614-555-0177" },

  { id: "21", companyName: "Stellar Freight & Logistics", website: "https://stellarfreight.com", industry: "Logistics",
    city: "Toledo", state: "OH", revenueUsd: 16_200_000, employeeCount: 94, ownerName: "Bo Okonkwo",
    ownerTitle: "Owner", yearFounded: 1985, email: "bo@stellarfreight.com", phone: "419-555-0566",
    sig: { https: true, mobileResponsive: false, copyrightYear: 2014, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: null, socialLinks: 0 } },

  { id: "22", companyName: "Fairview Home Health", website: "https://fairviewhomehealth.com", industry: "Home Health",
    city: "Dayton", state: "OH", revenueUsd: 6_800_000, employeeCount: 120, ownerName: "Celia Marchetti",
    ownerTitle: "Owner", yearFounded: 1997, email: "cmarchetti@fairviewhomehealth.com", phone: "937-555-0583",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2020, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: true, cms: "WordPress", socialLinks: 2 } },

  { id: "23", companyName: "Tri-State Fire Protection", website: "https://tristatefire.com", industry: "Fire Protection",
    city: "Cincinnati", state: "OH", revenueUsd: 7_300_000, employeeCount: 52, ownerName: "Walt Bergeron",
    ownerTitle: "Owner", yearFounded: 1983, email: "walt@tristatefire.com", phone: "513-555-0604",
    sig: { https: false, mobileResponsive: false, copyrightYear: 2011, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: null, socialLinks: 0 } },

  { id: "24", companyName: "Willow Creek Childcare", website: "https://willowcreekkids.com", industry: "Childcare",
    city: "Dublin", state: "OH", revenueUsd: 1_400_000, employeeCount: 26, ownerName: "Priya Raman",
    ownerTitle: "Owner", yearFounded: 2008, email: "priya@willowcreekkids.com", phone: "614-555-0621",
    sig: { https: true, mobileResponsive: true, copyrightYear: 2024, hasOnlineBooking: false, hasChatWidget: false, hasAnalytics: false, cms: "Wix", socialLinks: 2 } },
];

const defaultSignals = (over: Partial<DigitalSignals> = {}): DigitalSignals => ({
  hasWebsite: true, reachable: true, https: true, mobileResponsive: true, copyrightYear: 2026,
  hasOnlineBooking: true, hasEcommerce: false, hasChatWidget: true, hasAnalytics: true,
  hasContactForm: true, cms: "WordPress", pageBytes: 60_000, socialLinks: 3, fetchedAt: NOW,
  ...over,
});

export const SEED_LEADS: Lead[] = rows.map((r) => ({
  id: r.id, companyName: r.companyName, domain: r.domain ?? null, website: r.website ?? null,
  industry: r.industry ?? null, city: r.city ?? null, state: r.state ?? null, country: "US",
  revenueUsd: r.revenueUsd ?? null, employeeCount: r.employeeCount ?? null,
  ownerName: r.ownerName ?? null, ownerTitle: r.ownerTitle ?? null, yearFounded: r.yearFounded ?? null,
  email: r.email ?? null, phone: r.phone ?? null, linkedinUrl: null,
}));

/** Pre-computed signals so the demo needs no network. Rows without `sig` were never enriched. */
export const SEED_SIGNALS: Record<string, DigitalSignals | null> = Object.fromEntries(
  rows.map((r) => [r.id, r.sig ? defaultSignals(r.sig) : null]),
);
