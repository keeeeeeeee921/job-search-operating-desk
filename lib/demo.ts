export function isPublicDemo() {
  return process.env.JOB_DESK_PUBLIC_DEMO === "true";
}

export function getDemoBannerMessage() {
  return "Demo data resets daily at 3:00 AM ET."
}

export function shouldRunDemoResetNow(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false
  }).format(date);

  return hour === "03";
}
