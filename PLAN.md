# Швидкочитач — Optimized Implementation Plan (Web PWA)

## Platform Decision

**Original plan**: Native Android (Kotlin + Jetpack Compose)
**Optimized**: Next.js 14 + React PWA (Progressive Web App)

**Why**: Can be developed, tested, and deployed from CLI. Works on any device with a browser. Can be wrapped with Capacitor for Google Play Store later.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React + Tailwind CSS + shadcn/ui |
| State | Zustand (lightweight, no boilerplate) |
| Database | IndexedDB via Dexie.js (local, offline-first) |
| Charts | Recharts |
| PDF | pdf.js (Mozilla) |
| PWA | next-pwa (service worker, installable) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Testing | Vitest + Playwright |

---

## Architecture

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout + PWA setup
│   ├── page.tsx                # Splash → redirect
│   ├── onboarding/             # First-run onboarding
│   ├── home/                   # Main dashboard
│   ├── exercises/
│   │   ├── peripheral/         # Peripheral vision exercises
│   │   ├── schulte/            # Schulte tables
│   │   └── rsvp/               # RSVP reading
│   ├── library/                # Text library + PDF import
│   ├── test/[textId]/          # Comprehension test for a text
│   ├── profile/                # Stats + achievements
│   ├── settings/               # App settings
│   └── parent/                 # Parent control (PIN-protected)
├── components/
│   ├── ui/                     # shadcn/ui base components
│   ├── exercises/              # Exercise-specific components
│   ├── layout/                 # Navigation, headers
│   └── shared/                 # Reusable (ProgressBar, Avatar, Badge)
├── lib/
│   ├── db/                     # Dexie.js database + schemas
│   ├── stores/                 # Zustand stores
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Helpers (scoring, text parsing)
│   └── content/                # Built-in texts + questions (JSON)
├── types/                      # TypeScript interfaces
└── public/
    ├── manifest.json           # PWA manifest
    ├── icons/                  # App icons
    └── avatars/                # Avatar SVGs
```

---

## Database Schema (Dexie.js / IndexedDB)

### users
| Field | Type | Notes |
|-------|------|-------|
| id | auto | PK |
| name | string | required |
| age | number | |
| schoolClass | number | 1-11 |
| avatarId | number | |
| createdAt | Date | |
| lastLogin | Date | |

### trainingSessions
| Field | Type | Notes |
|-------|------|-------|
| id | auto | PK |
| userId | number | FK → users |
| sessionType | string | 'peripheral' / 'schulte' / 'rsvp' / 'test' |
| date | Date | |
| duration | number | seconds |
| result | object | exercise-specific results |
| score | number | points earned |
| speed | number | words/min (RSVP) |
| comprehension | number | % (tests) |

### texts
| Field | Type | Notes |
|-------|------|-------|
| id | auto | PK |
| title | string | |
| content | string | |
| difficulty | number | 1-5 |
| ageGroup | string | '1-4' / '5-8' / '9-11' |
| category | string | |
| wordCount | number | |
| source | string | 'builtin' / 'pdf' |
| isFavorite | number | 0/1 |

### testQuestions
| Field | Type | Notes |
|-------|------|-------|
| id | auto | PK |
| textId | number | FK → texts |
| question | string | |
| questionType | string | 'multiple_choice' / 'yes_no' / 'sequence' |
| correctAnswer | string | |
| options | string[] | for multiple choice |
| explanation | string | |

### testResults
| Field | Type | Notes |
|-------|------|-------|
| id | auto | PK |
| sessionId | number | FK → trainingSessions |
| questionId | number | FK → testQuestions |
| userAnswer | string | |
| isCorrect | boolean | |
| timeSpent | number | seconds |

### achievements
| Field | Type | Notes |
|-------|------|-------|
| id | auto | PK |
| userId | number | FK → users |
| badgeType | string | |
| earnedAt | Date | |

### dailyGoals
| Field | Type | Notes |
|-------|------|-------|
| id | auto | PK |
| userId | number | FK → users |
| date | string | YYYY-MM-DD |
| goalType | string | |
| target | number | |
| achieved | number | |

### settings
| Field | Type | Notes |
|-------|------|-------|
| userId | number | PK |
| theme | string | 'light' / 'dark' / 'auto' |
| fontSize | number | |
| reminderEnabled | boolean | |
| reminderTime | string | HH:MM |
| soundEnabled | boolean | |
| parentControlEnabled | boolean | |
| parentPin | string | |

---

## Implementation Phases

### Phase 1: Project Setup & Core Shell
- Initialize Next.js 14 project with TypeScript
- Configure Tailwind CSS + shadcn/ui
- Set up PWA (manifest, service worker, icons)
- Set up Dexie.js database with all schemas
- Create Zustand stores (user, settings, session)
- Build layout: bottom navigation, header
- Splash screen + onboarding flow (name, age, class, avatar)
- Home dashboard screen (static UI first)

### Phase 2: Schulte Tables
- Grid component (3×3, 4×4, 5×5)
- Random number generation
- Touch/click tracking in correct sequence
- Timer with millisecond precision
- Color mode (red-black variant)
- Results screen with time + stats
- Save session to DB

### Phase 3: Peripheral Vision Exercises
- Central flash mode (word appears center, timed)
- Random position mode (word at random screen location)
- Group perception mode (2-3 words simultaneously)
- Expanding zone mode
- Configurable speed, font size, word count, difficulty
- Word bank per age group
- Results + session saving

### Phase 4: RSVP Reader
- Text parser (split into words, handle punctuation pauses)
- RSVP player component with ORP (Optimal Recognition Point) highlighting
- Speed control: 100-1000 wpm with step of 50
- Play/pause/restart controls
- Progress indicator
- Phrase mode (2-4 words at a time)
- Text selection from library
- Session stats (speed, time, words read)

### Phase 5: Text Library
- Built-in library: ~50 Ukrainian texts (JSON)
  - 1-4 class: казки, байки (50-200 words) ~15 texts
  - 5-8 class: класика, науково-популярне (200-500 words) ~20 texts
  - 9-11 class: статті, есе (500-1500 words) ~15 texts
- Categories: казки, наука, класика, історія, природа
- List view with cards (title, word count, difficulty, category)
- Search and filter (by age group, category, difficulty)
- Favorites system
- PDF import via file picker + pdf.js parsing

### Phase 6: Comprehension Tests
- 3-5 questions per text (bundled in JSON with texts)
- Question types: multiple choice, yes/no, event sequence
- Test flow: question → answer → immediate feedback → explanation
- Scoring: % correct per test
- Link test results to reading session
- Save to testResults table

### Phase 7: Profile, Stats & Gamification
- Profile screen (avatar, name, class, level)
- Statistics dashboard:
  - Total training time
  - Session count
  - Average reading speed
  - Comprehension %
  - Charts (Recharts): progress over time, speed trend
- Level system (Початківець → Читач → Майстер → Чемпіон)
- Points calculation per activity
- Achievement badges (15-20 badges)
- Daily goals (3 auto-generated tasks per day)
- Streak tracking
- Confetti animation on achievements (canvas-confetti)

### Phase 8: Settings & Parent Control
- Theme switching (light/dark/auto)
- Font size adjustment
- Reminder notifications (via Notification API)
- Parent control panel:
  - PIN code gate
  - Detailed stats view
  - Usage time limits
  - Feature restrictions
- Multi-profile support (up to 5 profiles, profile switcher)
- Data export (stats to PDF via jsPDF)

### Phase 9: Polish & Testing
- Responsive design audit (phone, tablet)
- Accessibility: keyboard nav, ARIA labels, high contrast
- Performance optimization (lazy loading, code splitting)
- Animations polish (Framer Motion transitions)
- Vitest unit tests for stores, utils, scoring logic
- Playwright E2E tests for main flows
- PWA testing: offline mode, install prompt
- Lighthouse audit (target: 90+ all categories)

---

## Changes from Original Plan

### Removed (not applicable for web)
- Hilt DI → not needed (React context + Zustand)
- Room Database → replaced with Dexie.js (IndexedDB)
- WorkManager → replaced with Notification API + service worker
- ProGuard → Next.js handles tree-shaking
- APK optimization → web bundle optimization instead

### Simplified
- Navigation: Next.js App Router replaces Android Navigation Component
- State management: Zustand (3x less boilerplate than Redux)
- Theming: Tailwind dark mode + CSS variables (simpler than Material You)
- No need for separate domain/data/presentation layers — React hooks + stores are sufficient for this app scale

### Added
- PWA manifest + service worker for installability
- Responsive design (works on phone, tablet, desktop)
- PDF export of stats (jsPDF)
- Potential for easy web deployment (Vercel)

### Preserved (all features intact)
- All 4 exercise types (Schulte, peripheral, RSVP, comprehension)
- Full text library with Ukrainian content
- All gamification (levels, badges, streaks, daily goals)
- Parent control with PIN
- Multi-profile
- Offline-first architecture
- Dark/light theme
- PDF import
- All database entities and relationships
