import type { Metadata } from "next";
import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Saved pieces", robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <h1>Your Saved Pieces</h1>
          <p>Everything you&apos;ve hearted, in one place — come back any time.</p>
        </div>
        <SavedList />
      </div>
    </div>
  );
}
