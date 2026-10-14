import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMockJobBySlug } from "@/lib/mock-jobs";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = getMockJobBySlug(slug);

  if (!job) {
    return { robots: { index: false, follow: false } };
  }

  return {
    title: `${job.title} | ${job.company}`,
    description: job.description,
    // Synthetic postings for extraction demos; keep them out of search results.
    robots: { index: false, follow: false }
  };
}

export default async function MockJobPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = getMockJobBySlug(slug);

  if (!job) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location
      }
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <h1>{job.title}</h1>
      <p>{job.company}</p>
      <p>{job.location}</p>
      <article>{job.description}</article>
    </main>
  );
}
