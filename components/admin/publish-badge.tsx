export function PublishBadge({ published, deleted }: { published: boolean; deleted?: boolean }) {
  if (deleted) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
        Deleted
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-bold ${
        published ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}
