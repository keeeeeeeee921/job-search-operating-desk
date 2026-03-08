export function isPublicDemo() {
  return process.env.JOB_DESK_PUBLIC_DEMO === "true";
}

export function getDemoBannerMessage() {
  return "Demo data resets daily."
}
