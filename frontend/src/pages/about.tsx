import { useRef, useState } from "react";
import { BrandMark } from "~/components/brand/brand-mark";
import { PageIntro } from "~/components/ui/page-intro";
import { company } from "~/data/company";
import { useReveal } from "~/hooks/use-reveal";
import { cn } from "~/lib/cn";
import { buildMeta, organizationSchema } from "~/lib/seo";
import type { Route } from "./+types/about";

export const meta: Route.MetaFunction = () =>
  buildMeta({
    title: "Tentang Kami",
    description:
      "Kenali Solveit Indonesia: startup teknologi dan software house dengan visi membangun ekosistem layanan digital terintegrasi melalui Solveit OpsHub.",
    path: "/tentang",
    breadcrumbs: [{ name: "Tentang Kami", path: "/tentang" }],
    jsonLd: [organizationSchema()],
  });

const principles = [
  { name: "Memahami", text: "Kami mulai dari masalah bisnis, bukan dari fitur atau teknologi." },
  { name: "Merancang", text: "Ruang lingkup dan desain disepakati sebelum kode ditulis." },
  {
    name: "Membangun",
    text: "Pengembangan bertahap dengan hasil yang bisa dicoba di setiap tahap.",
  },
  { name: "Merawat", text: "Sistem dipelihara dan dikembangkan setelah rilis, bukan ditinggal." },
];

// Static class strings so Tailwind can see them: dim every capsule but one.
const dimOthers = [
  "[&_[data-capsule]:not([data-capsule='0'])]:opacity-20",
  "[&_[data-capsule]:not([data-capsule='1'])]:opacity-20",
  "[&_[data-capsule]:not([data-capsule='2'])]:opacity-20",
  "[&_[data-capsule]:not([data-capsule='3'])]:opacity-20",
];

const values = [
  {
    name: "Jujur soal ruang lingkup",
    text: "Kami menyampaikan apa yang realistis dikerjakan, berapa lama, dan apa risikonya, termasuk saat jawabannya bukan yang ingin didengar.",
  },
  {
    name: "Presisi di detail",
    text: "Kecepatan halaman, aksesibilitas, validasi data, dan pesan kesalahan adalah bagian dari pekerjaan, bukan tambahan.",
  },
  {
    name: "Tuntas sampai dipakai",
    text: "Proyek selesai ketika sistem dipakai dengan baik oleh tim Anda, bukan ketika kode terakhir dikirim.",
  },
  {
    name: "Tumbuh bersama klien",
    text: "Arsitektur disiapkan untuk bertambah besar, agar sistem tidak perlu dibangun ulang saat bisnis berkembang.",
  },
];

const roadmap = [
  { name: "Website company profile", status: "Sedang berjalan", current: true },
  { name: "Konsultasi dan pemesanan layanan", status: "Direncanakan" },
  { name: "Proposal dan kontrak digital", status: "Direncanakan" },
  { name: "Invoice dan pembayaran", status: "Direncanakan" },
  { name: "Pelacakan progres dan revisi", status: "Direncanakan" },
  { name: "Pemeliharaan dan tiket dukungan", status: "Direncanakan" },
];

export default function About() {
  const scope = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<number | null>(null);
  useReveal(scope);

  return (
    <div ref={scope}>
      <PageIntro
        breadcrumbs={[{ name: "Tentang Kami" }]}
        title="Software house yang membangun untuk jangka panjang."
        lede={
          <p>
            {company.description} Kami bekerja dengan individu, UMKM, startup, organisasi, dan
            perusahaan yang membutuhkan solusi digital profesional.
          </p>
        }
      />

      <section
        aria-labelledby="vision-title"
        className="border-t border-line py-[var(--spacing-section)]"
      >
        <div className="shell grid gap-10 lg:grid-cols-12">
          <h2 id="vision-title" data-reveal className="text-heading font-wide lg:col-span-3">
            Visi
          </h2>
          <p
            data-reveal
            className="text-[clamp(1.6rem,3.2vw,2.7rem)] leading-[1.18] font-semibold tracking-[-0.025em] font-wide lg:col-span-9"
          >
            {company.vision}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="philosophy-title"
        className="bg-paper-sunken py-[var(--spacing-section)]"
      >
        <div className="shell grid items-center gap-14 lg:grid-cols-12">
          <div className="mx-auto w-[min(70vw,22rem)] lg:col-span-5 lg:w-full lg:max-w-[26rem]">
            <BrandMark
              className={cn(
                "w-full [&_[data-capsule]]:transition-opacity [&_[data-capsule]]:duration-500",
                focus !== null && dimOthers[focus],
              )}
              title="Ikon Solveit"
            />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <h2 id="philosophy-title" data-reveal className="max-w-[14ch] text-title">
              Empat bagian yang saling mengunci.
            </h2>
            <p data-reveal className="mt-6 measure text-ink-muted">
              Logo Solveit tersusun dari empat kapsul yang membentuk huruf S. Kami membaca bentuk
              itu sebagai cara kerja: setiap tahap memegang tahap berikutnya.
            </p>
            <ol className="mt-10 border-t border-line">
              {principles.map((item, index) => (
                <li key={item.name} data-reveal className="border-b border-line">
                  <button
                    type="button"
                    onPointerEnter={() => setFocus(index)}
                    onPointerLeave={() => setFocus(null)}
                    onFocus={() => setFocus(index)}
                    onBlur={() => setFocus(null)}
                    className="grid w-full gap-1 py-5 text-left sm:grid-cols-[10rem_1fr] sm:gap-6"
                    aria-describedby={`principle-${index}`}
                  >
                    <span className="text-lg font-bold font-wide">{item.name}</span>
                    <span id={`principle-${index}`} className="text-ink-muted">
                      {item.text}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="values-title" className="shell py-[var(--spacing-section)]">
        <h2 id="values-title" data-reveal className="max-w-[16ch] text-title">
          Nilai yang kami pegang saat bekerja.
        </h2>
        <dl className="mt-14 grid gap-x-12 gap-y-14 md:grid-cols-2 lg:mt-20">
          {values.map((value) => (
            <div key={value.name} data-reveal className="border-t-2 border-ink pt-6">
              <dt className="text-heading font-bold tracking-[-0.025em] font-wide">{value.name}</dt>
              <dd className="mt-4 measure text-ink-muted">{value.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="roadmap-title"
        className="border-t border-line py-[var(--spacing-section)]"
      >
        <div className="shell">
          <h2 id="roadmap-title" data-reveal className="max-w-[18ch] text-title">
            Arah pengembangan: Solveit OpsHub.
          </h2>
          <p data-reveal className="mt-6 measure text-ink-muted">
            OpsHub adalah portal yang sedang kami rancang agar seluruh perjalanan proyek berada di
            satu tempat. Fitur di bawah ini adalah rencana, belum tersedia untuk digunakan.
          </p>
          <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roadmap.map((stage) => (
              <li
                key={stage.name}
                data-reveal
                className={cn(
                  "flex min-h-36 flex-col justify-between gap-6 rounded-[var(--radius-panel)] p-7",
                  stage.current
                    ? "bg-accent text-accent-ink"
                    : "border border-line bg-paper-raised",
                )}
              >
                <span className="text-xl font-bold tracking-[-0.02em] font-wide">{stage.name}</span>
                <span
                  className={cn(
                    "self-start rounded-full px-3 py-1 text-sm font-semibold",
                    stage.current
                      ? "bg-[#f4f7ff] text-[#1136d6]"
                      : "bg-paper-sunken text-ink-muted",
                  )}
                >
                  {stage.status}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
