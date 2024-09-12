import clsx from "clsx";
import Link from "next/link";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Link
        href="/upload"
        className={clsx(
          ["fixed", "bottom-4", "right-4"],
          ["btn", "btn-circle", "btn-ghost", "z-10"]
        )}
      >
        ↑
      </Link>
      <>{children}</>
    </>
  );
}
