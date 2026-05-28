import { getHomeModel } from "@/lib/db/repository";

export default async function AdminAnnouncementsPage() {
  const { announcements } = await getHomeModel();

  return (
    <section className="space-y-4 p-5">
      <h1 className="text-2xl font-black tracking-[-0.05em]">Announcements</h1>
      {announcements.map((announcement) => (
        <article key={announcement.id} className="rounded-[24px] bg-white p-5 shadow-card">
          <p className="text-lg font-black">{announcement.title}</p>
          <p className="mt-2 text-sm font-semibold text-[#6F7477]">{announcement.body}</p>
        </article>
      ))}
    </section>
  );
}
