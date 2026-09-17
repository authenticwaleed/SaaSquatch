/**
 * Vendor fingerprints for digital-maturity detection.
 *
 * Matched against the raw HTML (script srcs, link hrefs, inline config blobs),
 * which is deliberately cheap: one GET per company, no headless browser. It
 * trades a little recall for the ability to enrich hundreds of leads in seconds
 * inside a serverless function.
 */

export const BOOKING_VENDORS = [
  "calendly.com", "acuityscheduling.com", "squarespace-scheduling", "setmore.com",
  "booksy.com", "mindbodyonline.com", "schedulicity.com", "housecallpro.com",
  "servicetitan.com", "getjobber.com", "vagaro.com", "squareup.com/appointments",
  "simplybook.me", "appointy.com", "10to8.com", "youcanbook.me", "cal.com",
  "zenplanner.com", "janeapp.com", "dentrix", "opendental",
];

/** Copy that implies a booking flow even when the vendor is self-hosted. */
export const BOOKING_PHRASES = [
  "book now", "book online", "book an appointment", "schedule online",
  "schedule an appointment", "request an appointment", "book a service",
  "schedule service", "make an appointment",
];

export const ECOMMERCE_VENDORS = [
  "shopify", "woocommerce", "bigcommerce", "magento", "snipcart", "squarespace-commerce",
  "ecwid", "prestashop", "opencart", "bigcartel", "checkout.stripe.com", "shop.app",
];

export const ECOMMERCE_PHRASES = ["add to cart", "add to basket", "shopping cart", "proceed to checkout"];

export const CHAT_VENDORS = [
  "intercom.io", "intercomcdn", "drift.com", "tawk.to", "crisp.chat", "tidio",
  "livechatinc.com", "olark.com", "freshchat", "zdassets.com", "zendesk",
  "hubspot.com/conversations", "js.hs-scripts.com", "podium.com", "birdeye.com",
];

export const ANALYTICS_VENDORS = [
  "googletagmanager.com", "google-analytics.com", "gtag/js", "plausible.io",
  "usefathom.com", "matomo", "segment.com", "mixpanel", "hotjar", "clarity.ms",
  "amplitude.com", "posthog",
];

/** Order matters: more specific platforms are checked before generic markers. */
export const CMS_SIGNATURES: ReadonlyArray<[string, readonly string[]]> = [
  ["Shopify", ["cdn.shopify.com", "shopify-features"]],
  ["Squarespace", ["squarespace.com", "static1.squarespace", "sqs-block"]],
  ["Wix", ["wix.com", "wixstatic.com", "_wixCssImports"]],
  ["Webflow", ["webflow.com", "wf-form", "data-wf-page"]],
  ["Duda", ["dudamobile.com", "d-js-site"]],
  ["GoDaddy Website Builder", ["godaddysites.com", "img1.wsimg.com"]],
  ["HubSpot CMS", ["hs-sites.com", "hubspotusercontent"]],
  ["Drupal", ["/sites/default/files", "drupal.js", "drupal-settings-json"]],
  ["Joomla", ["/media/jui/", "joomla"]],
  ["WordPress", ["/wp-content/", "/wp-includes/", "wp-json"]],
];

export const SOCIAL_HOSTS = [
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
  "youtube.com", "tiktok.com", "yelp.com",
];

/** Matches "© 2015", "Copyright 2015-2019", "&copy; 2020". */
export const COPYRIGHT_YEAR = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})/gi;
