import { useEffect } from "react";
import { useStore, type Lang } from "@/store";

const dict = {
  he: {
    brand: "שאול", newChat: "שיחה חדשה", navChat: "שיחה", navFiles: "קבצים",
    today: "היום", yesterday: "אתמול", earlier: "קודם", untitled: "שיחה חדשה",
    toLight: "מעבר למצב בהיר", toDark: "מעבר למצב כהה", langAria: "Switch to English", langBtn: "EN",
    openNav: "פתיחת תפריט", cmdAria: "חיפוש ופעולות", settings: "הגדרות חיבור", deleteChat: "מחיקת שיחה",
    askPh: "שאלו את שאול על המסמכים שלכם", hint: "כל תשובה מגיעה עם המקור שלה", send: "שליחה", stop: "עצירה",
    searching: "מחפש במסמכים שלכם…", copy: "העתקת תשובה", regen: "יצירת תשובה מחדש", copied: "הועתק ללוח", sources: "מקורות",
    eH: "שאלו את שאול", eP: "התשובות מגיעות עם העמוד שמהם נלקחו. לחצו על מקור כדי לקרוא אותו.",
    pickT: "על אילו קבצים לשאול?", pickS: "שאול יענה רק על סמך הקבצים שסימנתם.", popT: "קבצים לשיחה הזו",
    selAll: "בחירת הכול", selVisible: "בחירת התוצאות", clearAll: "ניקוי הבחירה", onlySel: "נבחרו בלבד",
    chipAll: "כל הקבצים", chipN: "{n} קבצים", chipNone: "בחרו קבצים", pickSearch: "חיפוש קובץ", pickCount: "נבחרו {n} מתוך {m}",
    noReady: "עדיין אין קבצים מוכנים. אפשר להעלות קבצים במסך הקבצים.", goFiles: "למסך הקבצים",
    errGeneric: "משהו השתבש בבקשה.", retry: "ניסיון חוזר", errNoSetup: "צריך להגדיר חיבור ל-RAGFlow.",
    filesSub: "{n} מסמכים. {r} מוכנים לשימוש בשיחה.", filesSubUnknown: "מסמכים שמוכנים לשימוש בשיחה.", searchFiles: "חיפוש קבצים",
    fAll: "הכול", fReady: "מוכן", fBusy: "בעיבוד", fFailed: "נכשל", upload: "העלאת קבצים",
    dropT: "שחררו כדי להעלות", dropS: "אחרי ההעלאה הקבצים מעובדים, ואז אפשר לשאול עליהם בשיחה.",
    colName: "שם", colSize: "גודל", colChunks: "קטעים", colStatus: "סטטוס",
    st_ready: "מוכן", st_parsing: "בעיבוד", st_queued: "ממתין", st_failed: "נכשל", st_canceled: "בוטל", st_uploading: "מעלה…",
    start: "התחלת עיבוד", stopParse: "עצירה", view: "צפייה", del: "מחיקה", delConfirm: "למחוק?", noMatch: "אין קבצים תואמים.",
    emptyFiles: "עדיין אין קבצים", emptyFilesS: "העלו קבצים כדי להתחיל לשאול עליהם.",
    prevPageList: "העמוד הקודם", nextPageList: "העמוד הבא", range: "{a}–{b}",
    updated: "עודכן {when}", justNow: "הרגע", minAgo: "לפני {n} דק׳", hrAgo: "לפני {n} שע׳", dayAgo: "לפני {n} ימים", on: "ב-{d}",
    close: "סגירה", viewDocBtn: "צפייה במסמך", viewFileBtn: "צפייה בקובץ", download: "הורדת המקור", prevSrc: "מקור קודם", nextSrc: "מקור הבא",
    pg: "עמוד {p}", match: "{x}% התאמה", chunks: "{n} קטעים", passageNote: "אלה הקטעים שהתשובה מבוססת עליהם. כדי לראות את העמוד המלא, לחצו על צפייה במסמך.",
    pv_t_ready: "מוכן לשימוש בשיחה", pv_t_failed: "העיבוד נכשל", pv_t_busy: "בעיבוד", pv_t_idle: "עוד לא עובד",
    pv_ready: "הקובץ מחולק ל-{n} קטעים. כל אחד מהם יכול להופיע כמקור בשיחה.", pv_failed: "אפשר לנסות שוב. הסיבה מופיעה למטה.", pv_busy: "אפשר להמשיך לשוחח בזמן שזה מסתיים.", pv_idle: "התחילו עיבוד כדי שאפשר יהיה לשאול על הקובץ.",
    find: "חיפוש", found: "{n} נמצאו", none: "לא נמצא", prevPage: "עמוד קודם", nextPage: "עמוד הבא", zoomOut: "הקטנה", zoomIn: "הגדלה", pageAria: "עמוד {n}",
    loadingDoc: "טוען את הקובץ…", noPreview: "אין תצוגה מקדימה לסוג הקובץ הזה.", downloadFile: "הורדת הקובץ", sheet: "גיליון",
    dlStart: "מוריד את המקור…", processStarted: "העיבוד התחיל", deleted: "הקובץ נמחק", uploadFailed: "ההעלאה נכשלה",
    cmdPh: "חיפוש שיחות, קבצים ופעולות", noRes: "אין תוצאות", a_new: "שיחה חדשה", a_files: "מעבר לקבצים", a_chat: "מעבר לשיחה", a_upload: "העלאת קבצים", a_theme: "החלפת מצב תצוגה", a_lang: "החלפת שפה", a_settings: "הגדרות חיבור", a_open: "פתיחת {name}",
    setT: "חיבור ל-RAGFlow", setS: "הכתובת והמפתח נשמרים בדפדפן הזה בלבד.", baseUrl: "כתובת ה-API", baseUrlHint: "ברירת מחדל: /ragflow (מועבר דרך השרת של האתר).", apiKey: "מפתח API", apiKeyHint: "אפשר ליצור אותו במסך ההגדרות של RAGFlow.",
    datasetId: "מזהה מאגר", chatId: "מזהה עוזר צ׳אט", autoHint: "אם ריק, נוצר אוטומטית בחיבור הראשון.",
    connect: "בדיקת חיבור ושמירה", connecting: "מתחבר…", connected: "מחובר. המאגר והעוזר מוכנים.", connectFail: "החיבור נכשל: {msg}", cancel: "ביטול",
    ensureFail: "לא ניתן להכין מאגר ועוזר: {msg}",
  },
  en: {
    brand: "Shaul", newChat: "New chat", navChat: "Chat", navFiles: "Files",
    today: "Today", yesterday: "Yesterday", earlier: "Earlier", untitled: "New chat",
    toLight: "Switch to light mode", toDark: "Switch to dark mode", langAria: "החלפה לעברית", langBtn: "עב",
    openNav: "Open navigation", cmdAria: "Search and commands", settings: "Connection settings", deleteChat: "Delete chat",
    askPh: "Ask Shaul about your documents", hint: "Every answer comes with its source", send: "Send", stop: "Stop",
    searching: "Searching your documents…", copy: "Copy answer", regen: "Regenerate answer", copied: "Copied to clipboard", sources: "Sources",
    eH: "Ask Shaul", eP: "Answers come with the page they were taken from. Tap a source to read it.",
    pickT: "Which files should Shaul use?", pickS: "Shaul will answer only from the files you tick.", popT: "Files for this chat",
    selAll: "Select all", selVisible: "Select results", clearAll: "Clear all", onlySel: "Selected only",
    chipAll: "All files", chipN: "{n} files", chipNone: "Choose files", pickSearch: "Search files", pickCount: "{n} of {m} selected",
    noReady: "No files are ready yet. Upload some on the Files screen.", goFiles: "Go to Files",
    errGeneric: "Something went wrong with the request.", retry: "Retry", errNoSetup: "Set up the RAGFlow connection first.",
    filesSub: "{n} documents. {r} ready to use in chat.", filesSubUnknown: "Documents that are ready to use in chat.", searchFiles: "Search files",
    fAll: "All", fReady: "Ready", fBusy: "Processing", fFailed: "Failed", upload: "Upload files",
    dropT: "Release to upload", dropS: "Files are processed after upload, then you can ask about them in chat.",
    colName: "Name", colSize: "Size", colChunks: "Chunks", colStatus: "Status",
    st_ready: "Ready", st_parsing: "Processing", st_queued: "Waiting", st_failed: "Failed", st_canceled: "Canceled", st_uploading: "Uploading…",
    start: "Start processing", stopParse: "Stop", view: "View", del: "Delete", delConfirm: "Delete?", noMatch: "No files match.",
    emptyFiles: "No files yet", emptyFilesS: "Upload files to start asking about them.",
    prevPageList: "Previous page", nextPageList: "Next page", range: "{a}–{b}",
    updated: "Updated {when}", justNow: "just now", minAgo: "{n} min ago", hrAgo: "{n} h ago", dayAgo: "{n} days ago", on: "on {d}",
    close: "Close", viewDocBtn: "View in document", viewFileBtn: "View file", download: "Download original", prevSrc: "Previous source", nextSrc: "Next source",
    pg: "Page {p}", match: "{x}% match", chunks: "{n} chunks", passageNote: "These are the passages the answer is based on. To see the full page, open the document.",
    pv_t_ready: "Ready to use in chat", pv_t_failed: "Processing failed", pv_t_busy: "Processing", pv_t_idle: "Not processed yet",
    pv_ready: "Split into {n} passages. Any of them can appear as a source in chat.", pv_failed: "You can try again. The reason is shown below.", pv_busy: "Keep chatting while this finishes.", pv_idle: "Start processing so you can ask about this file.",
    find: "Find", found: "{n} found", none: "None", prevPage: "Previous page", nextPage: "Next page", zoomOut: "Zoom out", zoomIn: "Zoom in", pageAria: "Page {n}",
    loadingDoc: "Loading file…", noPreview: "No preview is available for this file type.", downloadFile: "Download file", sheet: "Sheet",
    dlStart: "Downloading original…", processStarted: "Processing started", deleted: "File deleted", uploadFailed: "Upload failed",
    cmdPh: "Search chats, files, and actions", noRes: "No results", a_new: "New chat", a_files: "Go to Files", a_chat: "Go to Chat", a_upload: "Upload files", a_theme: "Switch theme", a_lang: "Switch language", a_settings: "Connection settings", a_open: "Open {name}",
    setT: "Connect to RAGFlow", setS: "The address and key are stored in this browser only.", baseUrl: "API address", baseUrlHint: "Default: /ragflow (forwarded by this site's server).", apiKey: "API key", apiKeyHint: "Create one in RAGFlow's settings.",
    datasetId: "Dataset ID", chatId: "Chat assistant ID", autoHint: "Left empty, it is created automatically on first connect.",
    connect: "Test connection and save", connecting: "Connecting…", connected: "Connected. Dataset and assistant are ready.", connectFail: "Connection failed: {msg}", cancel: "Cancel",
    ensureFail: "Could not prepare dataset and assistant: {msg}",
  },
} as const;

export type Key = keyof (typeof dict)["en"];
type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  let s: string = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}

export function useT() {
  const lang = useStore((s) => s.lang);
  useEffect(() => {
    const d = document.documentElement;
    d.lang = lang;
    d.dir = lang === "he" ? "rtl" : "ltr";
    document.title = translate(lang, "brand");
  }, [lang]);
  return { lang, t: (key: Key, vars?: Vars) => translate(lang, key, vars) };
}
