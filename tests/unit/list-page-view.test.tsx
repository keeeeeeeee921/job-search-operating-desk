import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListPageView } from "@/components/list-page-view";
import type { PaginatedJobListResult } from "@/lib/types";

const emptyPage: PaginatedJobListResult = {
  records: [],
  page: 1,
  pageSize: 50,
  totalCount: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false
};

describe("ListPageView search cycle toggle", () => {
  // next/link schedules prefetch work after render; unmount before the jsdom
  // environment is torn down so the scheduler does not touch a missing window.
  afterEach(() => {
    cleanup();
  });

  it("links from the current cycle to the older cycles view and keeps the query", () => {
    render(
      <ListPageView
        basePath="/active"
        cycleView={{
          mode: "current",
          currentLabel: "Search 02",
          currentCount: 0,
          olderCount: 1857
        }}
        pageData={emptyPage}
        query="analyst"
        searchable
        title="Active"
      />
    );

    expect(screen.getByRole("link", { name: "Older cycles (1857)" })).toHaveAttribute(
      "href",
      "/active?cycle=older&q=analyst"
    );
    expect(screen.getByText("No matches in Active")).toBeInTheDocument();
  });

  it("explains an empty current cycle instead of calling it a failed search", () => {
    render(
      <ListPageView
        basePath="/active"
        cycleView={{
          mode: "current",
          currentLabel: "Search 02",
          currentCount: 0,
          olderCount: 6
        }}
        pageData={emptyPage}
        searchable
        title="Active"
      />
    );

    expect(screen.getByText("No Active records in Search 02 yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Older cycles (6)" })).toHaveAttribute(
      "href",
      "/active?cycle=older"
    );
  });

  it("links back to the current cycle and keeps the search form in the older view", () => {
    render(
      <ListPageView
        basePath="/active"
        cycleView={{
          mode: "older",
          currentLabel: "Search 02",
          currentCount: 53,
          olderCount: 1857
        }}
        pageData={{ ...emptyPage, totalCount: 1857, totalPages: 38, hasNextPage: true }}
        searchable
        title="Active"
      />
    );

    expect(screen.getByRole("link", { name: "Search 02 (53)" })).toHaveAttribute(
      "href",
      "/active"
    );
    expect(screen.getByRole("link", { name: "Older cycles (1857)" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByText("1-50 of 1857")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/active?cycle=older&page=2"
    );
    expect(document.querySelector('input[name="cycle"]')).toHaveAttribute("value", "older");
  });

  it("carries the list view into detail links so Back returns to it", () => {
    render(
      <ListPageView
        basePath="/active"
        cycleView={{
          mode: "older",
          currentLabel: "Search 02",
          currentCount: 53,
          olderCount: 1857
        }}
        detailBasePath="/active"
        pageData={{
          ...emptyPage,
          records: [
            {
              id: "job-1",
              roleTitle: "Data Analyst",
              company: "Acme",
              location: "",
              link: "",
              timestamp: "2026-03-01T00:00:00.000Z",
              stage: "no_response",
              sourceType: "company",
              sourceConfidence: "high",
              extractionStatus: "confirmed",
              jobDescriptionPreview: ""
            }
          ],
          page: 3,
          totalCount: 1857,
          totalPages: 38,
          hasPreviousPage: true,
          hasNextPage: true
        }}
        query="data"
        searchable
        title="Active"
      />
    );

    expect(screen.getByRole("link", { name: "Data Analyst" })).toHaveAttribute(
      "href",
      "/active/job-1?cycle=older&q=data&page=3"
    );
  });
});
