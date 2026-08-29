<div align="center">

<img src="https://img.shields.io/badge/React%20Native-Expo-black?style=for-the-badge&logo=expo&logoColor=gold" />
<img src="https://img.shields.io/badge/Firebase-Firestore-black?style=for-the-badge&logo=firebase&logoColor=gold" />
<img src="https://img.shields.io/badge/Status-Active-black?style=for-the-badge&color=2d5a27" />

<br /><br />



# 📦 NGO Control Center
### QR-Based Inventory & Logistics Management System

*Replacing clipboards with QR codes. Replacing guesswork with real-time data.*

---

</div>

## 🌍 What Is This?

A full-stack mobile application built for **NGOs and relief organizations** to manage **any type of aid inventory** — food, medical, therapeutic, hygiene, agricultural — using a **dynamic, admin-configurable commodity catalog**, QR-coded boxes, real-time Firestore sync, and atomic transactions.

No more spreadsheets. No more hardcoded item lists. Just define your commodities, pack boxes from templates, scan, dispatch, and go.

---

## 📸 Screenshots
| Sign In | Dashboard (Dark) | Dashboard (Light) |
|--------|-----------------|-------------------|
| ![Sign In](https://github.com/AveeckPandey/QR-Based-Supply-Chain-Inventory-Management-System-for-NGOs/blob/5e9290d185e9ea0b5c38220b9460167650c8cba9/assets/SignIn%20page.jpeg?raw=true) | ![Dark Dashboard](https://github.com/AveeckPandey/QR-Based-Supply-Chain-Inventory-Management-System-for-NGOs/blob/5e9290d185e9ea0b5c38220b9460167650c8cba9/assets/Dasboard.jpeg?raw=true) | ![Light Dashboard](https://github.com/AveeckPandey/QR-Based-Supply-Chain-Inventory-Management-System-for-NGOs/blob/5e9290d185e9ea0b5c38220b9460167650c8cba9/assets/dashboard%20in%20light%20mode.jpeg?raw=true) |

| Manage Boxes | QR Print View | QR Scanner |
|-------------|--------------|------------|
| ![Boxes](https://github.com/AveeckPandey/QR-Based-Supply-Chain-Inventory-Management-System-for-NGOs/blob/5e9290d185e9ea0b5c38220b9460167650c8cba9/assets/Manage%20Boxes.jpeg?raw=true) | ![QR Print](https://github.com/AveeckPandey/QR-Based-Supply-Chain-Inventory-Management-System-for-NGOs/blob/a0ea7fa782b66d2819f51b57df9695b5ac156c84/assets/QR%20code.jpeg?raw=true) | ![Scanner](https://github.com/AveeckPandey/QR-Based-Supply-Chain-Inventory-Management-System-for-NGOs/blob/a0ea7fa782b66d2819f51b57df9695b5ac156c84/assets/QR%20Scanner.jpeg?raw=true) |

---

## ✨ Features

### 📋 Dynamic Commodity Catalog (NEW — v2.0)
- **Admin-configurable commodities** in Firestore (`/commodities`) — no hardcoded item lists
- **Per-commodity schema**: name, unit (kg/pack/tablet/vial/L/unit), icon, color, category (food/therapeutic/medical/hygiene/agriculture/other), default qty per box, required flag, sort order
- **Expiry & batch tracking flags** — enforce batchNumber/expiryDate per line when enabled
- **7 defaults seeded** on first run: Rice, Dal, Sachets, Amoxicillin, RUTF, ORS, Hygiene Kit (stable IDs for template portability)
- **Soft-delete** preserves audit history; category filters on Admin screen

### 📦 Box Templates (NEW — v2.0)
- **Reusable box recipes** referencing commodity IDs (e.g., "Standard Food Box", "Medical Kit", "Hygiene Pack")
- Default template auto-selected; admins create custom templates via Admin screen
- Templates drive Add/Edit Box UI — only required commodities shown, quantities pre-filled from `defaultPerBox`

### 🔳 QR-Based Box Tracking
- Every box gets a **unique QR code** on creation
- Scan QR to instantly fetch box details
- Print or download QR labels for physical tagging

### 📦 Full Box Lifecycle
Each box moves through three states:

```
[ STORED ] ──dispatch──► [ DISPATCHED ] ──return──► [ RETURNED ]
    ▲                                                      │
    └──────────────────────────────────────────────────────┘
```

Inventory is **automatically adjusted** at every state transition.

### 📊 Real-Time Dashboard
- Live stock levels for **all active commodities** (not just 3 fixed items)
- Summary metrics: Possible Boxes (per template), Total Boxes, Target Coverage %
- Visual inventory bar chart (dynamic categories)
- Box status counters (Stored / Dispatched / Returned)

### 🎯 Target Planning
Set a box target for any template and instantly see **per-commodity shortages** (auto-calculated from current stock vs. target × template recipe).

### 🔐 Admin Inventory Control
A separate admin panel for manual stock corrections — ensures ground-level accuracy without breaking live tracking.

### ⚡ Transaction-Safe Updates
All Firestore writes use **atomic transactions** to guarantee:
- No negative inventory
- No double-dispatch
- No data races under concurrent use

### 🌓 Light / Dark Mode
Toggle between light and dark themes from the dashboard header.

### 🌐 Multi-Language (i18n)
English + Hindi built-in; extensible via `src/i18n/`.

### 📴 Offline-Aware
Network status banner + cached reads; graceful degradation when offline.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Frontend | React Native (Expo) |
| Database | Firebase Firestore |
| Authentication | Firebase Auth |
| QR Generation | `react-native-qrcode-svg` |
| QR Scanning | `expo-camera` |
| Hosting (Admin) | Firebase Hosting / AWS Amplify |

---

## 🧠 Architecture

```
┌─────────────────────────────────────┐
│       React Native (Expo App)        │
│                                      │
│  ┌──────────┐   ┌─────────────────┐ │
│  │ QR Scan  │   │ Manual Dispatch │ │
│  └────┬─────┘   └────────┬────────┘ │
│       └────────┬──────────┘         │
│           ┌────▼────┐               │
│           │Firebase │               │
│           │  Auth   │               │
│           └────┬────┘               │
│           ┌────▼──────────────┐     │
│           │ Firestore DB      │     │
│           │ ├── /boxes        │     │
│           │ ├── /inventory    │     │
│           │ └── /users        │     │
│           └───────────────────┘     │
└─────────────────────────────────────┘
```

---

## 📱 App Screens

| Screen | Purpose |
|--------|---------|
| **Sign In / Sign Up** | Firebase Auth-based login with password strength indicator |
| **Dashboard** | Live KPIs for all commodities, inventory chart, target planning (per template), action buttons |
| **Manage Boxes** | Search, edit, view all boxes with inline QR previews |
| **QR Scanner** | Camera-based scanning to trigger dispatch/return flows |
| **Box Details** | View full box contents (all commodity lines), update status |
| **Admin Inventory** | Manually adjust stock for **any commodity** (dynamic list) |
| **Admin Commodities** | **NEW** — Create/edit/delete commodities, set units, categories, expiry/batch flags, icons, colors |
| **Admin Templates** | **NEW** — Create/edit box templates referencing commodity IDs with default quantities |
| **QR Print View** | Full-size printable QR with box metadata |

---

## ⚙️ Installation

### Prerequisites
- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`)
- A Firebase project with Firestore and Auth enabled

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/your-username/ngo-control-center.git
cd ngo-control-center

# 2. Install dependencies
npm install

# 3. Set up environment variables (see below)

# 4. Start the development server
npx expo start
```

Scan the QR in your terminal with **Expo Go** (iOS/Android) or run on a simulator.

---

## 🔐 Environment Setup

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

> ⚠️ Never commit your `.env` file. It's already in `.gitignore`.

---

## 🗄️ Firestore Data Model

```
  /commodities/{commodityId}
    ├── name: string
    ├── unit: string              // kg, pack, tablet, vial, L, unit...
    ├── icon: string              // MaterialCommunityIcons name
    ├── color: string             // hex
    ├── category: string          // food | therapeutic | medical | hygiene | agriculture | other
    ├── defaultPerBox: number
    ├── required: boolean
    ├── sortOrder: number
    ├── expiryTracking: boolean   // requires batchNumber + expiryDate per line
    ├── batchTracking: boolean    // requires batchNumber per line
    ├── _deleted: boolean         // soft delete
    └── createdAt, updatedAt: timestamp

  /config/boxTemplates/{templateId}
    ├── name: string
    ├── lines: [{ commodityId, qty, sortOrder }]
    ├── default: boolean
    └── _deleted: boolean

  /boxes/{boxId}
    ├── lines: [{ commodityId, qty, batchNumber?, expiryDate? }]
    ├── status: "stored" | "dispatched" | "returned"
    ├── templateId: string?       // which template was used (for analytics)
    └── createdAt, updatedAt: timestamp

  /inventory/global
    ├── {commodityId}: number     // dynamic keys — one per active commodity
    └── updatedAt: timestamp
```

---

## 🎯 Use Case

Built for NGOs managing **multi-category aid distribution**:

- Define your commodity catalog (food, medical, hygiene, agriculture, etc.)
- Create box templates (recipes) for different distribution scenarios
- Pack boxes with measured quantities per template
- Tag each box with a printed QR code
- Dispatch boxes to field teams via QR scan
- Receive returned/unused boxes back into inventory
- Monitor per-commodity shortfalls before campaigns launch
- Track expiry/batch for medical & therapeutic items

---

## 🚀 Major Upgrade from v1 (Hardcoded → Dynamic)

| Area | v1 (Previous) | v2.0 (Current) |
|------|---------------|----------------|
| **Commodities** | Hardcoded: Rice, Dal, Sachets only | **Dynamic catalog** in `/commodities` — unlimited items, admin-managed |
| **Units** | Fixed (kg, pack) | **Any unit**: kg, pack, tablet, vial, L, unit... |
| **Categories** | None | **6 categories**: food, therapeutic, medical, hygiene, agriculture, other |
| **Expiry/Batch** | Not supported | **Per-commodity flags** — enforced in Add/Edit Box |
| **Box Templates** | None | **Reusable recipes** referencing commodity IDs |
| **Admin UI** | Manual rice/dal/sachet adjust only | **Full Commodities + Templates admin screens** |
| **Dashboard** | 3 fixed KPIs | **Dynamic KPIs** for all active commodities |
| **Target Planning** | 3 fixed shortages | **Per-template shortage calc** (any commodity mix) |
| **Firestore** | Fixed fields per box | **Dynamic lines array** per box + dynamic `/inventory/global` keys |
| **Architecture** | Single context, dual auth listeners | **Split contexts** (User, Warehouse, Commodities, Language, Network); single auth source |
| **Theme** | Hardcoded | **Persisted light/dark** + system fallback |
| **Error Handling** | Basic | **ErrorBoundary + SnackbarHost + PermissionBanner + OfflineBanner** |
| **Testing** | None | **Jest unit tests** (inventory math, unit conversion, box lines) |
| **TypeScript** | No | **Full TS + ESLint (Expo config)** |

---

## 📈 Impact

- ✅ ~70% reduction in manual inventory tracking effort
- ✅ Instant QR-based stock visibility in the field
- ✅ Real-time shortage alerts prevent under-stocking
- ✅ Atomic transactions eliminate data corruption

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

```bash
git checkout -b feature/your-feature
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

---

## 📄 License

MIT © [Aveeck Pandey]

---

<div align="center">

*Built with ❤️ for organizations that feed the world.*

</div>
