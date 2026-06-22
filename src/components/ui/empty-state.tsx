import Link from "next/link";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-green-800/30 bg-white p-8 text-center">
      <h2 className="text-2xl font-bold text-green-950">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-600">
        {body}
      </p>
      <Link
        href={actionHref}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-green-800 px-5 text-sm font-bold text-white"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
