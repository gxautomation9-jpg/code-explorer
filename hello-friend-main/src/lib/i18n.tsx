import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "en" | "ar";

const dict = {
  en: {
    appName: "Astra Intelligence",
    tagline: "Your Personal Multilingual AI Operating System",
    heroDesc: "A premium AI assistant that thinks in Arabic and English — including dialects and mixed speech. Built for clarity, speed, and beautiful conversation.",
    getStarted: "Get Started",
    signIn: "Sign In",
    signUp: "Sign Up",
    signOut: "Sign Out",
    dashboard: "Dashboard",
    chat: "Chat",
    tasks: "Tasks",
    memories: "Memories",
    settings: "Settings",
    newChat: "New chat",
    search: "Search",
    send: "Send",
    stop: "Stop",
    email: "Email",
    password: "Password",
    name: "Name",
    continueWithGoogle: "Continue with Google",
    or: "or",
    askAnything: "Ask anything in Arabic or English…",
    emptyChat: "Start a conversation with Astra",
    emptyChatHint: "Type a message below, or pick a suggestion.",
    features: "Capabilities",
    pricing: "Pricing",
    faq: "FAQ",
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    creativity: "Creativity",
    responseLength: "Response length",
    enableMemory: "Enable memory",
    deleteAllData: "Delete all data",
    exportData: "Export data",
    addTask: "Add task",
    addMemory: "Add memory",
    title: "Title",
    description: "Description",
    priority: "Priority",
    status: "Status",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    todo: "To do",
    in_progress: "In progress",
    done: "Done",
    archived: "Archived",
    low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
  },
  ar: {
    appName: "أسترا للذكاء",
    tagline: "نظام تشغيل الذكاء الاصطناعي الشخصي متعدد اللغات",
    heroDesc: "مساعد ذكي متميز يفكر بالعربية والإنجليزية — بما في ذلك اللهجات والكلام المختلط. مصمم للوضوح والسرعة ومحادثة جميلة.",
    getStarted: "ابدأ الآن",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    signOut: "تسجيل الخروج",
    dashboard: "الرئيسية",
    chat: "محادثة",
    tasks: "المهام",
    memories: "الذاكرة",
    settings: "الإعدادات",
    newChat: "محادثة جديدة",
    search: "بحث",
    send: "إرسال",
    stop: "إيقاف",
    email: "البريد",
    password: "كلمة المرور",
    name: "الاسم",
    continueWithGoogle: "متابعة بحساب جوجل",
    or: "أو",
    askAnything: "اسأل أي شيء بالعربية أو الإنجليزية…",
    emptyChat: "ابدأ محادثة مع أسترا",
    emptyChatHint: "اكتب رسالة بالأسفل، أو اختر اقتراحًا.",
    features: "المميزات",
    pricing: "الأسعار",
    faq: "الأسئلة الشائعة",
    language: "اللغة",
    theme: "المظهر",
    dark: "داكن",
    light: "فاتح",
    creativity: "الإبداع",
    responseLength: "طول الرد",
    enableMemory: "تفعيل الذاكرة",
    deleteAllData: "حذف كل البيانات",
    exportData: "تصدير البيانات",
    addTask: "إضافة مهمة",
    addMemory: "إضافة ذاكرة",
    title: "العنوان",
    description: "الوصف",
    priority: "الأولوية",
    status: "الحالة",
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    todo: "للقيام", in_progress: "قيد التنفيذ", done: "منجزة", archived: "مؤرشفة",
    low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة",
  },
} as const;

type Key = keyof typeof dict["en"];

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "en", setLang: () => {}, t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("astra-lang")) as Lang | null;
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem("astra-lang", l);
  };

  return (
    <I18nCtx.Provider value={{ lang, setLang, t: (k) => dict[lang][k] ?? k }}>
      {children}
    </I18nCtx.Provider>
  );
}

export const useI18n = () => useContext(I18nCtx);
