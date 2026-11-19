/**
 * "Save from an open page": a bookmarklet reads the posting the browser has
 * already rendered and hands it to the desk, so nothing depends on the server
 * being allowed to fetch the job site (Workday answers server fetches with
 * HTTP 429).
 *
 * Cross-origin hand-off, in order:
 * 1. The bookmarklet opens the desk's home page in a window named
 *    CAPTURE_WINDOW_NAME. That is a top-level navigation, so the existing
 *    SameSite=Lax access cookie is sent and the middleware applies as usual
 *    (signed out → /login → back to the home page).
 * 2. The home page posts CAPTURE_READY_MESSAGE to its opener.
 * 3. The bookmarklet answers with the payload, addressed to the desk's origin
 *    only.
 * 4. The home page posts the payload to /api/capture (same origin, cookie
 *    checked) and opens the usual review dialog.
 *
 * The job page never makes a request to the desk, so no CORS headers and no
 * cookie changes are needed, and the bookmarklet carries nothing but the
 * desk's origin.
 */

export const CAPTURE_WINDOW_NAME = "job-desk-capture";
export const CAPTURE_READY_MESSAGE = "job-desk-capture-ready";
export const CAPTURE_MESSAGE_TYPE = "job-desk-capture";

/** Longest page text accepted as a job description. */
export const CAPTURE_MAX_TEXT_CHARS = 200_000;
/** Longest stripped DOM accepted for field extraction. */
export const CAPTURE_MAX_HTML_CHARS = 1_500_000;

export interface CapturePayload {
  url: string;
  title: string;
  text: string;
  html: string;
}

/**
 * Validate a message received from another window. Anything that is not a
 * well-formed capture is ignored; the content itself is still untrusted text.
 */
export function parseCapturePayload(data: unknown): CapturePayload | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const candidate = data as Record<string, unknown>;
  if (
    candidate.type !== CAPTURE_MESSAGE_TYPE ||
    typeof candidate.url !== "string" ||
    typeof candidate.text !== "string"
  ) {
    return null;
  }

  return {
    url: candidate.url,
    title: typeof candidate.title === "string" ? candidate.title : "",
    text: candidate.text,
    html: typeof candidate.html === "string" ? candidate.html : ""
  };
}

/**
 * Runs inside the job page. Kept ES5-plain and self-contained because it is
 * serialized into a `javascript:` URL.
 *
 * Text: the reader's selection when there is one (lets them pick the exact
 * posting body), otherwise the largest <main>/<article>, otherwise the whole
 * page. It is the rendered text as-is; nothing is summarized.
 *
 * HTML: a copy of the DOM without scripts, styles and media, sent only so
 * the server can read the title, company and location from JSON-LD and meta
 * tags with the same generic logic the "Paste link" path uses.
 */
function captureSource(
  origin: string,
  windowName: string,
  readyMessage: string,
  messageType: string,
  maxText: number,
  maxHtml: number
) {
  return `(function(){
var T=${JSON.stringify(origin)};
if(location.origin===T){alert("Open a job posting first, then click this bookmark.");return}
function pick(){
var s=String(window.getSelection?window.getSelection():"").trim();
if(s.length>=200)return s;
var best="",els=document.querySelectorAll('main,[role="main"],article');
for(var i=0;i<els.length;i++){var t=(els[i].innerText||"").trim();if(t.length>best.length)best=t}
if(best.length>=500)return best;
return((document.body&&document.body.innerText)||"").trim()}
var c=document.documentElement.cloneNode(true);
var junk=c.querySelectorAll('script:not([type="application/ld+json"]),style,svg,noscript,iframe,link,img,picture,video,canvas,template');
for(var j=0;j<junk.length;j++)junk[j].remove();
var p={type:${JSON.stringify(messageType)},url:location.href,title:document.title,text:pick().slice(0,${maxText}),html:c.outerHTML.slice(0,${maxHtml})};
var w=window.open(T+"/",${JSON.stringify(windowName)});
if(!w){alert("Job Desk: allow pop-ups for this site, then click the bookmark again.");return}
function h(e){
if(e.origin!==T||e.source!==w||e.data!==${JSON.stringify(readyMessage)})return;
window.removeEventListener("message",h);
w.postMessage(p,T)}
window.addEventListener("message",h);
setTimeout(function(){window.removeEventListener("message",h)},600000);
})();`;
}

/** The script the bookmarklet runs, for a desk served from `origin`. */
export function buildCaptureScript(origin: string) {
  return captureSource(
    origin,
    CAPTURE_WINDOW_NAME,
    CAPTURE_READY_MESSAGE,
    CAPTURE_MESSAGE_TYPE,
    CAPTURE_MAX_TEXT_CHARS,
    CAPTURE_MAX_HTML_CHARS
  );
}

/** The `javascript:` URL to save as a bookmark. */
export function buildCaptureBookmarklet(origin: string) {
  return `javascript:${encodeURIComponent(buildCaptureScript(origin))}`;
}
