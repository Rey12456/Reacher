import { GoogleButton } from "./google-button";

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="size-2.5 bg-signal" aria-hidden />
          Reacher
        </div>
        <h1 className="mt-6 text-2xl font-bold leading-tight">Who should you reach out to?</h1>
        <p className="mt-2 text-[15px] text-stone-600">
          Enter a company and role. Get the people most worth contacting, why, and drafts you send yourself.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-[15px] text-red-700">
          Sign-in didn&apos;t complete. Please try again.
        </p>
      )}
      <GoogleButton />
    </main>
  );
}
