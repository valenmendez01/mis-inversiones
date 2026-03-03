// app/(dashboard)/layout.tsx
import { Navbar } from "@/components/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col h-screen">
      <Navbar />
      <main className="container mx-auto max-w-7xl pt-6 px-6 flex-grow">
        {children}
      </main>
    </div>
  );
}