# Project: Brutalist Daily OS

## Tech Stack
* **Frontend:** React (Vite) + Tailwind CSS
* **Animations/Gestures:** Framer Motion (CRITICAL for the nested scroll wheels and swipe gestures)
* **Icons:** Lucide React
* **Backend/Auth:** Firebase (Firestore + Auth)
* **Form Handling:** React Hook Form

## Design System & "Vibe"
* **Aesthetic:** NothingOS meets Brutalism. Minimalist, high contrast, industrial.
* **Typography:** Primary font is a strict Sans-Serif (e.g., Inter or Helvetica Neue in uppercase). Secondary font for numbers/dates should be a Dot-Matrix or Monospace font (e.g., Space Mono or a web-safe dot font) to mimic the NothingOS widgets.
* **Colors:** * Background: `#F5F5F5` (Light Mode) / `#121212` (Dark Mode).
    * Text: `#000000` / `#FFFFFF`.
    * Accents: Muted Sage Green, Terracotta Orange, and a piercing Neon Red/Orange for active states (referencing the workout/finance UI images).
* **UI Elements:** Hard borders (1px solid black/gray), pill-shaped bottom navigation, minimal drop shadows. 

## Core User Flow
1.  **Auth:** Simple email/password or Google sign-in.
2.  **Home Page (Today's Snapshot):** User lands on a mobile-first constrained view. Displays the current Date/Time, a list of today's tasks, and today's total spendings.
3.  **Navigation (The Wheels):** The right side of the screen features a half-visible dual-wheel UI. 
    * *Inner Wheel:* Scrolls to change modes (Tasks, Finance, Journal, Notes).
    * *Outer Wheel:* Scrolls to change the Date context for the selected mode.
4.  **Action:** User clicks "Add Task" from the bottom pill nav. A brutalist pop-up appears to capture Task Name, Schedule Date, Due Date, and Type (Work/School/Routine).
5.  **Interaction:** User holds and swipes a task right to edit properties, or left to mark as complete.

## Data Schema (Firebase Collections)
* **`users`**: { uid, email, preferences }
* **`tasks`**: { id, uid, title, scheduledDate, dueDate, type, isCompleted, createdAt }
* **`transactions`**: { id, uid, amount, type (income/expense), category, date, note }
* **`journals`**: { id, uid, date, diaryEntry, moments, brainDump, imageUrls, autoSyncedData: { tasksCompleted, totalSpent } }