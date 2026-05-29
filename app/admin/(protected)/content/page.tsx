import { saveBoulderAction, saveCragAction, saveRouteAction } from "@/lib/actions/admin-content";
import { getAllRouteItems, getHomeModel } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const home = await getHomeModel();
  const routes = await getAllRouteItems();

  return (
    <section className="space-y-5 p-5">
      <AdminPanel title="Crag CRUD">
        <form action={saveCragAction} className="grid gap-3">
          <input name="areaId" defaultValue="area-capital" />
          <input name="name" placeholder="Crag name" />
          <input name="slug" placeholder="slug" />
          <input name="summary" placeholder="summary" />
          <input name="lat" placeholder="lat" />
          <input name="lng" placeholder="lng" />
          <input name="accessDesc" placeholder="access" />
          <input name="parkingDesc" placeholder="parking" />
          <input name="season" placeholder="season" />
          <input name="coverImageUrl" placeholder="cover image URL" />
          <label className="text-sm font-bold"><input name="isPublished" type="checkbox" /> Published</label>
          <button type="submit">Save Crag</button>
        </form>
      </AdminPanel>

      <AdminPanel title="Boulder CRUD">
        <form action={saveBoulderAction} className="grid gap-3">
          <input name="sectorId" defaultValue="sector-gamja" />
          <input name="name" placeholder="Boulder name" />
          <input name="slug" placeholder="slug" />
          <input name="lat" placeholder="lat" />
          <input name="lng" placeholder="lng" />
          <select name="coordPrecision" defaultValue="exact"><option value="exact">exact</option><option value="approximate">approximate</option><option value="hidden">hidden</option></select>
          <input name="rockType" placeholder="rock type" />
          <input name="hashtags" placeholder="#모락산, #슬랩" />
          <input name="coverImageUrl" placeholder="cover image URL" />
          <label className="text-sm font-bold"><input name="isPublished" type="checkbox" /> Published</label>
          <button type="submit">Save Boulder</button>
        </form>
      </AdminPanel>

      <AdminPanel title="Route CRUD">
        <form action={saveRouteAction} className="grid gap-3">
          <input name="topoId" defaultValue="topo-big-main" />
          <input name="boulderId" defaultValue="boulder-big" />
          <input name="name" placeholder="Route name" />
          <input name="slug" placeholder="slug" />
          <input name="grade" placeholder="V5" />
          <input name="gradeNum" placeholder="5" />
          <input name="fa" placeholder="FA" />
          <textarea name="description" placeholder="description" />
          <input name="lineImageUrl" placeholder="line image URL" />
          <label className="text-sm font-bold"><input name="isPublished" type="checkbox" /> Published</label>
          <button type="submit">Save Route</button>
        </form>
      </AdminPanel>

      <AdminPanel title="Current Seed Snapshot">
        <p className="text-sm font-semibold text-[#6F7477]">{home.totals.crags} crags · {routes.length} routes</p>
      </AdminPanel>
    </section>
  );
}

function AdminPanel({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <article className="rounded-[24px] bg-white p-5 shadow-card">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      <div className="[&_button]:h-11 [&_button]:rounded-full [&_button]:bg-[#1A1A1A] [&_button]:font-black [&_button]:text-white [&_input]:h-10 [&_input]:rounded-xl [&_input]:border [&_input]:border-[#E8E8E8] [&_input]:px-3 [&_select]:h-10 [&_select]:rounded-xl [&_textarea]:min-h-24 [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#E8E8E8] [&_textarea]:p-3">
        {children}
      </div>
    </article>
  );
}
