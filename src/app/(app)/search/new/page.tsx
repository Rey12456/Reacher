import { requireProfile } from "@/lib/auth";
import { SearchRunner } from "./search-runner";

export default async function NewSearchPage(props: PageProps<"/search/new">) {
  await requireProfile();
  const params = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <SearchRunner company={one(params.company)} role={one(params.role)} ask={one(params.ask) || "chat"} />;
}
