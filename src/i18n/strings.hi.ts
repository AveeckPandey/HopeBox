// P51: Hindi (hi) catalog. Mirrors the structure of `strings.js`
// (English). Any key that is missing here falls back to the
// English string at lookup time — the catalog loader in
// `LanguageContext` walks both maps and uses the English value
// when the Hindi entry is undefined.
//
// The translations target an NGO field-staff audience in
// Hindi-speaking regions. Technical terms (Donor, QR, "Box",
// "Dashboard", status names) are kept in their English form
// because that's what the staff are used to seeing in the
// printed labels.

import { strings as en } from "./strings";

export const strings = {
  app: {
    name: "होपबॉक्स",
    tagline: "NGO के लिए QR आपूर्ति श्रृंखला",
  },

  auth: {
    signIn: "साइन इन",
    signUp: "खाता बनाएँ",
    welcome: "वापसी पर स्वागत है",
    welcomeSub: "जारी रखने के लिए साइन इन करें",
    createHeading: "खाता बनाएँ",
    createSub: "आज ही हमसे जुड़ें",
    fullName: "पूरा नाम",
    email: "ईमेल",
    password: "पासवर्ड",
    emailPlaceholder: "you@example.com",
    passwordPlaceholder: "••••••••",
    namePlaceholder: "आपका नाम",
    forgotPassword: "पासवर्ड भूल गए?",
    noAccount: "खाता नहीं है?",
    haveAccount: "पहले से खाता है?",
    strengthLabels: {
      empty: "कम से कम 8 अक्षर",
      tooShort: "बहुत छोटा",
      fair: "ठीक है",
      strong: "मजबूत",
    },
    termsPrefix: "साइन अप करके आप हमारी ",
    termsSuffix: " और ",
    termsOfService: "सेवा की शर्तों",
    privacyPolicy: "गोपनीयता नीति",
    errors: {
      emailInvalid: "एक मान्य ईमेल पता दर्ज करें",
      passwordShort: "पासवर्ड कम से कम 8 अक्षर का होना चाहिए",
      nameRequired: "पूरा नाम आवश्यक है",
      emailInUse: "यह ईमेल पहले से पंजीकृत है। कृपया साइन इन करें।",
      invalidEmail: "अमान्य ईमेल पता।",
      weakPassword: "पासवर्ड बहुत कमज़ोर है। कम से कम 8 अक्षर और अक्षर-संख्या दोनों का उपयोग करें।",
      accountFailed: "खाता बनाने में विफल",
      invalidCredentials: "अमान्य ईमेल या पासवर्ड",
      timeout: "कनेक्शन का समय समाप्त। अपना इंटरनेट जाँचें और पुनः प्रयास करें।",
      tooManyRequests: "बहुत अधिक प्रयास। बाद में पुनः प्रयास करें।",
      noUser: "इस ईमेल से कोई खाता नहीं मिला।",
      wrongPassword: "गलत पासवर्ड।",
    },
  },

  forgotPassword: {
    eyebrow: "खाता पुनर्प्राप्ति",
    title: "पासवर्ड रीसेट करें",
    subtitle: "अपना ईमेल दर्ज करें, हम रीसेट लिंक भेजेंगे।",
    emailLabel: "ईमेल पता",
    emailPlaceholder: "you@example.com",
    send: "रीसेट लिंक भेजें",
    sending: "भेज रहा है...",
    success: "रीसेट लिंक भेजा गया। अपना इनबॉक्स देखें।",
    failed: "रीसेट लिंक नहीं भेजा जा सका",
    backToSignIn: "साइन इन पर वापस",
  },

  dashboard: {
    eyebrow: "NGO नियंत्रण केंद्र",
    title: "डैशबोर्ड",
    subtitle: "स्टॉक, बॉक्स की आवाजाही और अभियान की तैयारी को रियल-टाइम में ट्रैक करें।",
    liveInventory: "लाइव इन्वेंटरी",
    inventoryChart: "इन्वेंटरी चार्ट",
    boxStatus: "बॉक्स स्थिति",
    targetPlanning: "लक्ष्य योजना",
    actions: "क्रियाएँ",
    targetHelper: "आप कितने मानक बॉक्स तैयार करना चाहते हैं, सेट करें।",
    possibleBoxes: "संभावित बॉक्स",
    totalBoxes: "कुल बॉक्स",
    targetCoverage: "लक्ष्य कवरेज",
    riceShortage: "चावल की कमी",
    dalShortage: "दाल की कमी",
    sachetShortage: "सैशे की कमी",
    manageBoxes: "बॉक्स प्रबंधित करें",
    scanQR: "QR स्कैन करें",
    adminInventory: "इन्वेंटरी",
    analytics: "विश्लेषण",
    auditLog: "ऑडिट लॉग",
    exportCSV: "CSV निर्यात",
    exportPDF: "PDF निर्यात",
    exportSuccess: "CSV निर्यात हो गया",
    exportFailed: "CSV निर्यात नहीं हो सका",
    pdfSuccess: "PDF निर्यात हो गया",
    pdfFailed: "PDF निर्यात नहीं हो सका",
    exportEmpty: "अभी निर्यात के लिए कोई बॉक्स नहीं",
    themeLight: "लाइट मोड",
    themeDark: "डार्क मोड",
    signOut: "साइन आउट",
    signOutConfirm: "क्या आप अपने खाते से साइन आउट करना चाहते हैं?",
  },

  boxes: {
    eyebrow: "बॉक्स रजिस्ट्री",
    title: "बॉक्स प्रबंधित करें",
    subtitle: "एक ही साफ़ कार्यस्थल से खोजें, संपादित करें और QR प्रिंट करें।",
    searchPlaceholder: "Box ID से खोजें",
    filterAll: "सभी",
    emptyTitle: "अभी कोई बॉक्स नहीं",
    emptyMessage: "स्टॉक ट्रैक करना और QR लेबल बनाना शुरू करने के लिए अपना पहला बॉक्स बनाएँ।",
    emptyCta: "अपना पहला बॉक्स बनाएँ",
    noMatchesTitle: "कोई मिलान नहीं",
    noMatchesMessage: "कोई अन्य खोज या फ़िल्टर आज़माएँ।",
    countOne: "1 बॉक्स",
    countMany: "बॉक्स",
    boxId: "Box ID",
    stored: "संग्रहीत",
    dispatched: "वितरित",
    returned: "वापस",
    rice: "चावल",
    dal: "दाल",
    sachets: "सैशे",
    printQR: "QR प्रिंट करें",
    addBox: "नया बॉक्स जोड़ें",
    openBox: "बॉक्स {{id}} खोलें, स्थिति {{status}}",
    editBox: "बॉक्स {{id}} संपादित करें",
    deleteBox: "बॉक्स {{id}} हटाएँ",
    printBox: "बॉक्स {{id}} के लिए QR प्रिंट करें",
    delete: "हटाएँ",
    deleteConfirmTitle: "इस बॉक्स को हटाएँ?",
    deleteConfirmMessage: "बॉक्स रिकॉर्ड हटा दिया जाएगा। इन्वेंटरी प्रभावित नहीं होगी।",
    deleteSuccess: "बॉक्स हटा दिया गया",
    deleteFailed: "बॉक्स नहीं हटाया जा सका",
    donor: "दानदाता",
  },

  boxDetails: {
    eyebrow: "बॉक्स संचालन",
    title: "बॉक्स विवरण",
    subtitle: "बॉक्स की सामग्री देखें और उसकी डिलीवरी स्थिति अपडेट करें।",
    scanHistory: "स्कैन इतिहास",
    recentActivity: "हाल की गतिविधि",
    dispatch: "वितरित करें",
    return: "वापस करें",
    delete: "बॉक्स हटाएँ",
    currentStatus: "वर्तमान स्थिति",
    dispatchSuccess: "बॉक्स वितरित किया गया",
    returnSuccess: "बॉक्स वापस किया गया",
    dispatchFailed: "इस बॉक्स को वितरित नहीं किया जा सका",
    returnFailed: "इस बॉक्स को वापस नहीं किया जा सका",
    deleteSuccess: "बॉक्स हटा दिया गया",
    deleteFailed: "बॉक्स नहीं हटाया जा सका",
    insufficientInventory: "अपर्याप्त इन्वेंटरी",
    dispatchConfirmTitle: "इस बॉक्स को वितरित करें?",
    dispatchConfirmMessage: "इन्वेंटरी बॉक्स की सामग्री से कम हो जाएगी। इसे पूर्ववत नहीं किया जा सकता।",
    returnConfirmTitle: "इस बॉक्स को वापस करें?",
    returnConfirmMessage: "इन्वेंटरी बॉक्स की सामग्री से बहाल हो जाएगी।",
    deleteConfirmTitle: "इस बॉक्स को हटाएँ?",
    deleteConfirmMessage: "बॉक्स रिकॉर्ड हटा दिया जाएगा। इन्वेंटरी प्रभावित नहीं होगी — केवल बॉक्स इतिहास।",
  },

  addBox: {
    eyebrow: "बॉक्स निर्माण",
    title: "नया बॉक्स बनाएँ",
    subtitle: "राशन की मात्रा भरें और बॉक्स तुरंत सहेजें।",
    riceKg: "चावल (किलो)",
    dalKg: "दाल (किलो)",
    sachetsCount: "सैशे",
    category: "श्रेणी (उदा., आपातकालीन, नियमित)",
    tags: "टैग (अल्पविराम से अलग)",
    donorName: "दानदाता का नाम (वैकल्पिक)",
    donorContact: "दानदाता संपर्क (वैकल्पिक)",
    create: "बॉक्स बनाएँ",
    success: "बॉक्स बनाया गया",
    failed: "बॉक्स नहीं बनाया जा सका",
    contents: "बॉक्स सामग्री",
    qty: "मात्रा",
    unit: "इकाई",
    unitHint: "1 {{unit}} = {{qty}} {{base}}",
    batchNumber: "बैच #",
    expiryDate: "समाप्ति तिथि",
    manufacturingDate: "निर्मित",
    template: "टेम्पलेट",
    templateNone: "कस्टम",
    addAtLeastOne: "कम से कम एक वस्तु की मात्रा जोड़ें",
  },

  commodities: {
    editItem: "{{name}} संपादित करें",
    deleteItem: "{{name}} हटाएँ",
    validationFailed: "कुछ पंक्तियों पर ध्यान देने की आवश्यकता है",
  },

  editBox: {
    eyebrow: "बॉक्स अपडेट",
    title: "बॉक्स संपादित करें",
    subtitle: "राशन की मात्रा और मेटाडेटा अपडेट करें।",
    save: "परिवर्तन सहेजें",
    contents: "बॉक्स सामग्री",
    success: "बॉक्स अपडेट हुआ",
    failed: "बॉक्स अपडेट नहीं हो सका",
  },

  adminInventory: {
    eyebrow: "व्यवस्थापक नियंत्रण",
    title: "इन्वेंटरी प्रबंधक",
    subtitle: "वेयरहाउस स्टॉक को मैन्युअल रूप से अपडेट करें। डैशबोर्ड और चार्ट इन संख्याओं को लाइव दिखाएँगे।",
    update: "इन्वेंटरी अपडेट करें",
    success: "इन्वेंटरी अपडेट हुई",
    failed: "इन्वेंटरी अपडेट नहीं हो सकी",
  },

  scan: {
    eyebrow: "स्कैन मोड",
    title: "बॉक्स QR स्कैन करें",
    subtitle: "विवरण खोलने के लिए QR कोड को फ्रेम में रखें।",
    back: "वापस",
    permissionTitle: "कैमरा अनुमति चाहिए",
    permissionMessage: "बॉक्स QR कोड स्कैन करने और सीधे विवरण खोलने के लिए कैमरा चालू करें।",
    permissionCta: "कैमरा अनुमति दें",
    preparing: "कैमरा तैयार हो रहा है",
    preparingMessage: "QR स्कैनिंग के लिए कैमरा एक्सेस जाँच रहे हैं।",
    boxNotFound: "बॉक्स नहीं मिला",
    scanFailed: "इस QR कोड को संसाधित नहीं किया जा सका",
    invalidCode: "मान्य बॉक्स QR कोड नहीं",
    cooldown: "रुकें...",
    cooldownShort: "ठीक है, जल्दी फिर स्कैन होगा",
    cooldownChip: "स्कैनिंग रुकी हुई",
  },

  print: {
    eyebrow: "QR निर्यात",
    title: "मुद्रण योग्य QR कार्ड",
    subtitle: "QR छवि सहेजें या स्वच्छ लेबल के लिए मूल प्रिंट संवाद खोलें।",
    download: "QR डाउनलोड",
    print: "QR प्रिंट",
    saving: "सहेज रहा है...",
    opening: "खोल रहा है...",
    saved: "QR सहेजा गया",
    savedDetail: "QR छवि शेयर शीट में तैयार है।",
    saveFailed: "सहेजने में विफल",
    saveFailedDetail: "QR छवि सहेजी नहीं जा सकी।",
    printFailed: "प्रिंट विफल",
    printFailedDetail: "प्रिंट संवाद नहीं खुल सका।",
  },

  analytics: {
    eyebrow: "अंतर्दृष्टि",
    title: "विश्लेषण डैशबोर्ड",
    subtitle: "इन्वेंटरी, वितरण और सिस्टम गतिविधि का अवलोकन।",
    inventoryTotals: "इन्वेंटरी कुल",
    boxStatusDistribution: "बॉक्स स्थिति वितरण",
    categories: "श्रेणियाँ",
    topDonors: "शीर्ष दानदाता",
    scanActivity: "स्कैन गतिविधि",
    scansByDate: "तारीख के अनुसार स्कैन",
    totalRice: "कुल चावल",
    totalDal: "कुल दाल",
    totalSachets: "कुल सैशे",
    totalScans: "कुल स्कैन",
    auditLogs: "ऑडिट लॉग",
  },

  auditLog: {
    eyebrow: "ऑडिट ट्रेल",
    title: "ऑडिट लॉग",
    subtitle: "सभी सिस्टम क्रियाओं का पूरा इतिहास।",
    emptyTitle: "अभी कोई ऑडिट लॉग नहीं",
    emptyMessage: "जब आप ऐप का उपयोग शुरू करेंगे, सिस्टम क्रियाएँ यहाँ दिखेंगी।",
    userLabel: "उपयोगकर्ता",
    unknownUser: "अज्ञात उपयोगकर्ता",
  },

  settings: {
    title: "सेटिंग्स",
    appearance: "रूप",
    themeLabel: "थीम",
    themeLight: "लाइट",
    themeDark: "डार्क",
    themeSystem: "सिस्टम",
    language: "भाषा",
    languageEnglish: "English",
    languageHindi: "हिन्दी",
    account: "खाता",
    signedInAs: "के रूप में साइन इन",
    role: "भूमिका",
    admin: "व्यवस्थापक",
    staff: "स्टाफ",
    viewer: "दर्शक",
    actions: "क्रियाएँ",
    adminInventory: "इन्वेंटरी प्रबंधित करें",
    auditLog: "ऑडिट लॉग",
    commodities: "वस्तुएँ",
    signOut: "साइन आउट",
  },

  status: {
    stored: "संग्रहीत",
    dispatched: "वितरित",
    returned: "वापस",
  },

  common: {
    save: "सहेजें",
    cancel: "रद्द करें",
    delete: "हटाएँ",
    edit: "संपादित करें",
    back: "वापस",
    loading: "लोड हो रहा है…",
    retry: "पुनः प्रयास",
    confirm: "पुष्टि करें",
    refreshing: "ताज़ा हो रहा है…",
    refresh: "ताज़ा करने के लिए खींचें",
    dismiss: "बंद करें",
    permissionDeniedTitle: "कुछ डेटा उपलब्ध नहीं है",
    permissionDeniedMessage: "आपके खाते के पास एक या अधिक अनुभागों तक पहुँच नहीं है। उच्च-विशेषाधिकार वाले खाते से साइन इन करें या व्यवस्थापक से अपनी भूमिका अपडेट करने को कहें।",
    offline: "आप ऑफ़लाइन हैं। कनेक्शन वापस आने पर परिवर्तन सिंक होंगे।",
  },
};

// Deep-merge fallback: any key present in `en` but missing in the
// Hindi catalog is filled with the English string. This keeps the
// loader simple — partial translations degrade gracefully.
function deepMerge(fallback: unknown, primary: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { ...((fallback as Record<string, unknown>) || {}) };
  for (const [k, v] of Object.entries((primary as Record<string, unknown>) || {})) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object"
    ) {
      out[k] = deepMerge(out[k], v);
    } else if (v !== undefined && v !== null && v !== "") {
      out[k] = v;
    }
  }
  return out;
}

export const merged = deepMerge(en, strings);
