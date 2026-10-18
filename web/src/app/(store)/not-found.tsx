import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="container" style={{ textAlign: "center" }}>
        <div className="page-head">
          <h1>We couldn&apos;t find that page</h1>
          <p>It may have moved, or the piece may no longer be available.</p>
        </div>
        <Link className="btn btn-primary" href="/shop">Browse the collection</Link>
      </div>
    </div>
  );
}
