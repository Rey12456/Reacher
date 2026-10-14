import { Nav } from "./nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-[1480px] flex-1 px-6 py-10 lg:px-12">{children}</main>
    </>
  );
}
