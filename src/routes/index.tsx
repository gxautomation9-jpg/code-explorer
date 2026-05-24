import { createFileRoute, Link } from "@tanstack/react-router";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Brain, CheckSquare, Globe2, Languages, Mic, MessageSquare, Shield, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Astra Intelligence — Premium Multilingual AI" },
      { name: "description", content: "Astra Intelligence: a premium AI assistant fluent in Arabic, English, and dialects. Chat, voice, memory, and task intelligence." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t, lang } = useI18n();

  const features = [
    { icon: Languages, title: lang === "ar" ? "ثنائي اللغة بإتقان" : "Truly Bilingual", desc: lang === "ar" ? "يفهم الفصحى والمصرية واللهجات والكلام المختلط." : "Understands MSA, Egyptian, dialects, and mixed Arabic-English." },
    { icon: Mic, title: lang === "ar" ? "صوت طبيعي" : "Natural Voice", desc: lang === "ar" ? "تحويل الكلام لنص ونص لكلام بجودة عالية." : "High-fidelity speech-to-text and text-to-speech." },
    { icon: Brain, title: lang === "ar" ? "ذاكرة ذكية" : "Smart Memory", desc: lang === "ar" ? "يتذكر تفضيلاتك وأسلوبك تحت سيطرتك." : "Remembers your preferences and style — under your control." },
    { icon: CheckSquare, title: lang === "ar" ? "إدارة المهام" : "Task Intelligence", desc: lang === "ar" ? "يستخرج المهام من محادثاتك تلقائيًا." : "Auto-extract tasks from your conversations." },
    { icon: Shield, title: lang === "ar" ? "خاص وآمن" : "Private & Secure", desc: lang === "ar" ? "بياناتك محمية بصلاحيات صفية صارمة." : "Your data is yours — protected by row-level security." },
    { icon: Zap, title: lang === "ar" ? "أداء فوري" : "Instant Performance", desc: lang === "ar" ? "ردود تدفقية فورية على أي جهاز." : "Streaming responses on any device." },
  ];

  return (
    <div className="min-h-screen">
      <Topbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute left-1/2 top-20 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]" />
        <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-24 text-center sm:pt-32">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-electric" />
            {lang === "ar" ? "نظام تشغيل ذكي جديد" : "A new kind of AI operating system"}
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-7xl">
            <span className="text-gradient">{t("appName")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
            {t("heroDesc")}
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="glow-electric">
              <Link to="/chat">{t("getStarted")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/" hash="features"><Globe2 className="me-2 h-4 w-4" />{t("features")}</Link>
            </Button>
          </div>

          <div className="mt-16 inline-flex items-center gap-2 rounded-2xl glass-strong p-1 text-xs text-muted-foreground">
            <span className="rounded-xl bg-electric/10 px-3 py-1.5 text-electric">AR</span>
            <span className="px-2">EN</span>
            <span className="px-2">EG</span>
            <span className="px-2">Mixed</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{lang === "ar" ? "كل ما تحتاجه في مكان واحد" : "Everything you need, in one place"}</h2>
          <p className="mt-3 text-muted-foreground">{lang === "ar" ? "محادثة، صوت، ذاكرة، ومهام — مصممة بإتقان." : "Chat, voice, memory, and tasks — crafted with care."}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group relative overflow-hidden rounded-2xl glass p-6 transition hover:border-electric/40">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-electric/60 to-transparent opacity-0 transition group-hover:opacity-100" />
              <f.icon className="mb-4 h-6 w-6 text-electric" />
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl glass-strong p-10 text-center sm:p-16">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-electric/10 via-transparent to-primary/10" />
          <MessageSquare className="mx-auto mb-4 h-8 w-8 text-electric" />
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {lang === "ar" ? "جاهز لتجربة الذكاء الحقيقي؟" : "Ready to meet real intelligence?"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {lang === "ar" ? "أنشئ حسابك في ثوانٍ. مجاني للبدء." : "Create your account in seconds. Free to start."}
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="glow-electric"><Link to="/chat">{t("getStarted")}</Link></Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">{t("faq")}</h2>
        <div className="space-y-3">
          {[
            { q: lang === "ar" ? "هل يدعم اللهجة المصرية؟" : "Does it understand Egyptian Arabic?", a: lang === "ar" ? "نعم، مع الفصحى واللهجات والكلام المختلط." : "Yes — MSA, dialects, and mixed Arabic-English speech." },
            { q: lang === "ar" ? "هل بياناتي خاصة؟" : "Is my data private?", a: lang === "ar" ? "محادثاتك مرتبطة بحسابك فقط، محمية بصلاحيات صارمة." : "Your conversations are tied only to your account, protected by strict access policies." },
            { q: lang === "ar" ? "هل أحتاج مفتاح API؟" : "Do I need an API key?", a: lang === "ar" ? "لا. كل شيء جاهز للاستخدام." : "No. Everything works out of the box." },
          ].map((item) => (
            <details key={item.q} className="group rounded-xl glass p-5">
              <summary className="cursor-pointer list-none text-base font-medium">{item.q}</summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("appName")}
      </footer>
    </div>
  );
}
