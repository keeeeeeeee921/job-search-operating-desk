"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCaptureBookmarklet } from "@/lib/capture";

/**
 * The "From open page" tab: a bookmark to drag to the bookmarks bar. Clicking
 * it on a job posting sends that page's text here for review.
 */
export function CaptureBookmarklet({ disabled }: { disabled?: boolean }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);

  // React refuses to render `javascript:` URLs, so the href is set on the
  // element directly. It is built from this page's own origin and holds no
  // token: signing in is still done by the cookie when the desk opens.
  useEffect(() => {
    if (disabled) {
      return;
    }

    linkRef.current?.setAttribute(
      "href",
      buildCaptureBookmarklet(window.location.origin)
    );
  }, [disabled]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(
        buildCaptureBookmarklet(window.location.origin)
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <ol className="max-w-2xl list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Drag the button below to your bookmarks bar. Once.</li>
        <li>Open a job posting and click the bookmark.</li>
        <li>The posting&apos;s text opens here for review before anything is saved.</li>
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {disabled ? (
          <span className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground">
            <BookmarkPlus aria-hidden="true" className="size-4" />
            Save to Job Desk
          </span>
        ) : (
          <a
            className="inline-flex cursor-grab items-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted active:cursor-grabbing"
            data-testid="capture-bookmarklet"
            draggable
            onClick={(event) => event.preventDefault()}
            ref={linkRef}
            title="Drag me to the bookmarks bar"
          >
            <BookmarkPlus aria-hidden="true" className="size-4 text-accent" />
            Save to Job Desk
          </a>
        )}
        <Button disabled={disabled} onClick={copyCode} tone="ghost" type="button">
          {copied ? "Copied" : "Copy bookmark code"}
        </Button>
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-5 text-muted-foreground">
        Select the posting text first if you want only that part. Otherwise the
        page&apos;s main text is taken as shown.
      </p>
    </div>
  );
}
