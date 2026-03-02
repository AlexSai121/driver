A task management app with a UI mixed between NothingOS, Google Material Expressive. (Lean more into the brutalist futuristic minimalist design of NothingOS)

**App Features**
- Start developing for IOS/ Android with packages
- Two scroll wheels attached to each other the larger wheel is for selecting the day and viewing the tasks on that day, while the inner/ smaller wheel is to change the modes
- **Modes**
	- View Journals (View all the journals - the larger scroll wheel determines the date of the journal) - there will be specific session/ button to select month
	- Finance Planner
		- A simple Transaction log of your funds (Filter view option - monthly spendings/ income by default)
		- Track Expenses & Income
		- Income and expenses automatically adds to journal at the funds section in journal
	- Tasks Management
		- Can view the done tasks
		- Filter the view (past or future tasks - time frame - etc)
	- Ideas/ Notes
		- A simple ideas capture or note 
- **Home page will provide the tasks for today & spendings for the day**

**App UI & What each page has**
Every page has the two scroll wheels larger and smaller embedded to each other. The small wheel has a fixed task to change the modes. The larger wheel will have different functions based on where you are on the page.

- Home page
	- Sample image will be provided
	- Date & Time
	- Tasks view for today
	- A nav bar at the bottom of the page with the buttons add ”add task, plan (planning for the day), journal
- Add Task Pop-Up Features:
	- Task Name
	- Schedule to do on
	- Due/ Finish before - default value is the scheduled date
	- What type - school, work, routine (can edit the types)
- Plan Template
	- To-Do for the day - will sync up the tasks from today in the template and if the user add a new task, that task will also appear on the homepage for today’s task
	- Meetings/ Appointments
	- 1 Thing to Accomplish/ 1% Improve Goal 
- Journal Template
	- Diary Entry (What happened during the day)
	- Moment/s of the day
	- Brain Dump
	- Feature to add images for the day

**Future Plans**
- Weekly/ Monthly/ Yearly Planner
- Habit Tracker with heatmap
- Focus Mode - This will block all notifications and focus on a task
- PARA Helper

## Latest Polishes (Done)
- **Scroll Distance**: Reduced sensitivity (2.5x slower) so it's much easier to land on a specific date.
- **Matte Material**: Applied a physical 3% noise texture overlay to the entire UI for a true matte finish.
- **Mode Wheel Index**: Fixed the inverted math; Finance and Plan now select correctly relative to the visual marker.

## UI/Feature Suggestions
- **Mechanical Audio**: Add "Click" sounds for wheel notches and "Clunk" for button presses to match haptics.
- **CRT Jitter**: Add a subtle scanline/jitter effect that triggers during fast scrolls for that "Cassette Futurism" vibe.
- **Gestural Eject**: Swipe a task far to the left to "eject" it off-screen with a mechanical slide animation to delete/archive.


npm run dev -- --host 