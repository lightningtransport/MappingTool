import RelationshipExplorer from "./relationship-explorer.js";
import { loadExplorerData } from "./load-explorer-data.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export { loadExplorerData } from "./load-explorer-data.js";

export default async function Page() {
  return <RelationshipExplorer data={await loadExplorerData()} />;
}
