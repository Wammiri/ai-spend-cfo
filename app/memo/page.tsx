import { SiteNav } from "@/components/site-nav";
import { SampleBanner } from "@/components/sample-banner";
import { MemoView, type MemoDocument } from "@/components/memo-view";
import memo from "@/data/precomputed-memo.json";

// Memo view (B1): renders the cached hero memo (D3). On the sample path there is
// no model call; the content is the committed precomputed-memo.json, whose every
// figure reconciles with the metrics layer (proven in aggregate.test.ts). The
// live "Download PDF" and the upload-driven live memo arrive in B5/B4.

const doc = memo as unknown as MemoDocument;

export default function MemoPage() {
  return (
    <div className="min-h-screen bg-ledger">
      <SiteNav />

      <main className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
        <div className="mb-5">
          <SampleBanner org={doc.meta.org} />
        </div>
        <MemoView memo={doc} />
      </main>
    </div>
  );
}
