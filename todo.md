# Pro-Esports Free Fire Tournament Platform - TODO

## Phase 1: Core Database & Authentication
- [x] Design and implement database schema for users, matches, wallets, and transactions
- [x] Set up role-based access control (admin vs player)
- [x] Implement secure admin credentials system with default credentials generation
- [x] Create user profile and authentication endpoints

## Phase 2: Match Scheduling System
- [x] Create match categories table (BR, CS, Lone Wolf)
- [x] Implement match modes (1v1, 2v2, 4v4) with category associations
- [x] Build hourly time-slot generation engine for advance listing
- [x] Implement flexible future-match booking system
- [x] Create auto-cycle mechanism for new matches as time progresses
- [x] Build match listing API for all three tabs

## Phase 3: Wallet & Balance System
- [x] Design three-tier balance system (Deposit, Winning, Bonus)
- [x] Implement wallet creation and initialization for new users
- [x] Build deposit flow with 12-digit UTR validation
- [x] Create withdrawal system (Winning Balance only, min 20 Coins/INR)
- [x] Implement UPI and Google Play Redeem Code payout methods
- [x] Build transaction history tracking

## Phase 4: Prize Calculation & Payout Logic
- [x] Implement 20% admin profit deduction from entry fees
- [x] Build kill-based reward system (2 Coins/INR per kill)
- [x] Create prize distribution logic for BR (Top 5) and other modes (Winner)
- [x] Build admin result entry system (kill count + rank input)
- [x] Implement automatic payout calculation and distribution
- [x] Create match result storage and history

## Phase 5: Automatic Refund & Match Cancellation
- [x] Implement player count monitoring for BR matches
- [x] Build automatic cancellation logic (< 10 players)
- [x] Create instant refund mechanism to player wallets
- [x] Implement cancellation notifications to affected players

## Phase 6: UTR Warning System
- [x] Create multi-language UTR warning component (English, Bengali, Hindi)
- [x] Display warnings on Home page
- [x] Display warnings on Wallet page
- [x] Display warnings on Add Money page
- [x] Build "How to find UTR" visual guide modal/button

## Phase 7: Secure Admin Dashboard
- [x] Create hidden admin route (obfuscated path)
- [x] Build username/password login for admin panel
- [x] Implement deposit approval/rejection interface
- [x] Build withdrawal processing interface
- [x] Create kill count and rank result entry form
- [x] Implement Room ID/Password management interface
- [x] Build admin dashboard analytics and monitoring

## Phase 8: Room ID/Password Visibility Logic
- [x] Implement 15-minute pre-match visibility timer
- [x] Hide Room ID/Password from all players until timer triggers
- [x] Make Room ID/Password visible only to joined participants
- [x] Create notification system for when credentials become visible

## Phase 9: Refer & Earn System
- [x] Create referral code generation for users
- [x] Build referral link sharing mechanism
- [x] Implement first deposit tracking for referred users
- [x] Create automatic 5 Coins/INR bonus credit to referrer
- [x] Create automatic 5 Coins/INR bonus credit to new user
- [x] Build referral history and earnings tracking

## Phase 10: Device Restriction & Security Firewall
- [x] Implement Android device detection
- [x] Block iOS devices with clear message
- [x] Block desktop browsers with clear message
- [x] Block emulators and tablets with clear message
- [x] Create device fingerprinting system
- [x] Implement anti-hack detection and instant ban mechanism
- [x] Build admin panel for managing banned accounts

## Phase 11: UI/UX - Premium Dark Gaming Theme
- [x] Configure Neon Red, Carbon Black, Gold color palette
- [x] Implement gaming-style typography and fonts
- [x] Create animated navigation and transitions
- [x] Build responsive mobile-first layout (Android optimization)
- [x] Implement dark mode theme globally
- [x] Add gaming-style animations and micro-interactions
- [x] Create loading states and skeleton screens

## Phase 12: Core Pages & Navigation
- [x] Build Home page with match listings and quick actions
- [x] Create BR tab with match scheduling
- [x] Create CS tab with 1v1, 2v2, 4v4 mode selection
- [x] Create Lone Wolf tab with 1v1 mode
- [x] Build Wallet page with balance display
- [x] Build Add Money page with deposit form
- [x] Create Withdrawal page with payout method selection
- [x] Build User Profile page (via Wallet integration)

## Phase 13: WhatsApp Support Integration
- [x] Create floating WhatsApp support button component
- [x] Implement on all pages with persistent visibility
- [x] Add WhatsApp contact number configuration
- [x] Create support button styling matching gaming theme

## Phase 14: Match Joining & Player Management
- [x] Build match joining interface
- [x] Implement entry fee deduction from player wallet
- [x] Create player list for joined matches
- [x] Build match confirmation and cancellation for players
- [x] Implement player status tracking (joined, confirmed, cancelled)

## Phase 15: Notifications & Alerts
- [x] Create in-app notification system
- [x] Build match start reminders
- [x] Implement result notification system
- [x] Create payout completion notifications
- [x] Build withdrawal status notifications

## Phase 16: Testing & Quality Assurance
- [x] Write unit tests for wallet calculations
- [x] Write tests for prize distribution logic
- [x] Write tests for device restriction logic
- [x] Write tests for admin operations
- [x] Perform end-to-end testing of match flow
- [x] Test all payment scenarios
- [x] Verify multi-language content display

## Phase 17: Final Integration & Deployment
- [x] Verify all features work together
- [x] Optimize for Android mobile performance
- [x] Test on various Android devices and browsers
- [x] Create admin credentials and documentation
- [x] Final security audit
- [x] Deploy to production

## Phase 18: Users Management (Admin)
- [x] Add backend procedure to list all users with wallet balances
- [x] Add backend mutation for manual coin adjustment (add/deduct)
- [x] Create Users Management tab in Admin Dashboard
- [x] Implement user search/filter functionality
- [x] Build Add/Deduct Coins modal for each user
- [x] Add transaction logging for manual adjustments
- [x] Verify existing UTR deposit flow remains untouched

## Phase 19: BR Modes Fix & Enhanced Join Flow
- [x] Fix BR category modes: Solo, Duo, Squad (remove 1v1, 2v2, 4v4)
- [x] Update matchModes initialization to use correct BR modes
- [x] Add Free Fire IGN and UID fields to matchParticipants table
- [x] Create player details modal form component
- [x] Add join procedure with player details validation
- [x] Update match joining to deduct entry fee and record player info
- [x] Display match rules in join modal
- [x] Test BR mode creation and joining flow

## Phase 20: Admin Match Creation Dropdown Fix
- [x] Update Mode dropdown to show BR modes (Solo, Duo, Squad) when BR is selected
- [x] Update Mode dropdown to show CS/LW modes (1v1, 2v2, 4v4) for other categories
- [x] Ensure selected mode value is correctly sent to backend
- [x] Test admin match creation with different category selections

## Phase 21: Admin Match Creation Fix & Dynamic Mode Filtering
- [x] Fix backend validation to accept Solo/Duo/Squad modes
- [x] Fix match start time parsing and ISO formatting
- [x] Add success notification after match creation
- [x] Reset form fields after successful creation
- [x] Update player app to dynamically filter modes by category
- [x] Verify BR shows only Solo/Duo/Squad
- [x] Verify CS/LW shows only 1v1/2v2/4v4

## Phase 22: Debug Match Creation Submission
- [x] Verify form submission handler is being called
- [x] Check backend receives the request with correct payload
- [x] Ensure mode validation accepts Solo/Duo/Squad
- [x] Verify date parsing to ISO timestamp
- [x] Test error handling and toast messages
- [x] Confirm match is saved to database
- [x] Changed createMatch to use adminProcedure
- [x] Added detailed logging throughout createMatch flow
- [x] Added try-catch for database errors with proper error messages

## Phase 23: Fix Match Creation & Player Joining Flow
- [x] Verify admin match creation saves without errors
- [x] Test BR category with Solo/Duo/Squad modes
- [x] Verify player join modal shows rules and input fields
- [x] Test wallet deduction (Deposit first, then Bonus)
- [x] Prevent duplicate joins with button state change
- [x] Verify join confirmation shows success message
- [x] Add isJoined prop to MatchCard rendering
- [x] Implement joined status tracking in Home.tsx

## Phase 24: Supabase Production Data Migration
- [x] Superseded by the approved Neon PostgreSQL production migration; not executed against Supabase
- [x] Superseded by the approved Neon PostgreSQL production migration; not executed against Supabase
- [x] Superseded by `neon_migration.sql`, which provisions the PostgreSQL schema, indexes, triggers, and RLS policies in Neon
- [x] Superseded by the Neon-backed application data layer; no Supabase client is used
- [x] Superseded by the Neon helper hardening work; silent database-unavailable fallbacks were removed
- [x] Superseded by Neon read and rollback-only write-contract validation; no Supabase writes were run
- [x] Superseded by `docs/neon-migration.md`, which documents the Neon rollout sequence

## Phase 25: Neon PostgreSQL Production Migration
- [x] Configure the supplied Neon DATABASE_URL through secure project environment settings
- [x] Validate Neon connectivity with a read-only Vitest database probe
- [x] Convert the Drizzle schema and database helpers from MySQL to PostgreSQL
- [x] Generate and apply a complete Neon PostgreSQL schema migration
- [x] Replace mock or fallback data paths with real Neon queries
- [x] Test critical reads and writes against Neon without creating test records
- [x] Deliver the executable SQL migration and deployment instructions

## Phase 26: Neon Migration Hardening
- [x] Remove silent database-unavailable fallback returns from the Neon helper layer
- [x] Add transaction-rollback tests for Neon match, wallet, deposit, and withdrawal write contracts
- [x] Add committed Neon migration and deployment instructions

## Phase 27: Secure Tournament Workflow Integration
- [x] Make player match joining atomically deduct Deposit balance before Bonus balance and register the participant
- [x] Automatically calculate and credit eligible kill and rank prizes when an admin submits match results
- [x] Connect player withdrawal requests to the admin pending-withdrawal queue and secure its processing actions
- [x] Restrict Room ID and Password retrieval to joined players after the configured credential release time
- [x] Wire the existing Admin and Player interfaces to the completed tRPC procedures
- [x] Add rollback-safe automated coverage for the new financial and access-control contracts

## Phase 28: Admin Authorization and Workflow Contract Verification
- [x] Replace local-only admin access with an authenticated server-side administrator gate for all admin data actions
- [x] Add rollback-safe Neon integration coverage for atomic match joining and withdrawal queue settlement
- [x] Add access-control coverage for room credential and public match response boundaries

## Phase 29: Final Workflow Security Hardening
- [x] Protect every remaining admin-facing query with server-side administrator authorization
- [x] Add integration-level coverage that invokes the real transactional workflow helpers
- [x] Add automated positive and negative room-credential access-boundary coverage

## Phase 30: Neon Administrator Credential Configuration
- [x] Verify the existing Admin Panel credential verification path
- [x] Store the requested administrator username and secure password hash for rosidulshah4@gmail.com
- [x] Verify the Neon administrator record and document the required sign-in sequence

## Phase 31: Administrator Login Delivery Verification
- [x] Document the OAuth and Neon credential sequence required to access the Admin Panel
- [x] Verify the authenticated administrator credential procedure end-to-end without exposing secrets

## Phase 32: Player Profile and Account Controls
- [x] Add a protected Neon profile summary with match, kill, and earning statistics
- [x] Add secure editing for the player’s Free Fire display name and UID
- [x] Build the Player Profile page in the existing dark gaming visual system
- [x] Add a visible Profile navigation entry from the main player screen
- [x] Add reliable logout and switch-account actions without clearing browser/app data
- [x] Add automated tests and validate the mobile profile experience

## Phase 33: Player Profile Flow Completion
- [x] Force fresh OAuth account selection for the Switch Account action
- [x] Add profile aggregation and successful update coverage against Neon
- [x] Verify Profile navigation and account actions on the Android player experience

## Phase 34: Mobile Profile Interaction Verification
- [x] Add automated coverage for the Home-to-Profile navigation and account-action intent
- [x] Validate Profile, Logout, and Switch Account behavior through automated contracts; add runtime tests confirming desktop is blocked and Android mobile is allowed

## Phase 35: Home Identity and Wallet Balance Repair
- [x] Ensure the Home welcome area renders the signed-in player name with an email fallback
- [x] Set rosidulshah4@gmail.com bonus balance to exactly 100 Coins in Neon and record the adjustment
- [x] Verify the real Neon wallet query returns current balances to the Home player view
- [x] Add regression coverage for Home identity fallback and wallet balance data contracts

## Phase 36: Live Wallet Query Verification
- [x] Invoke the real authenticated wallet.getBalance procedure for the updated Neon account
- [x] Add regression coverage for the current Neon wallet balance router contract
- [x] Confirm the Home wallet section consumes the verified balance shape

## Phase 37: Wallet Router Regression Coverage
- [x] Add rollback-safe automated coverage for the authenticated wallet.getBalance router procedure

## Phase 38: Dynamic Home Welcome Identity
- [x] Remove the generic Player fallback from the authenticated Home welcome header
- [x] Display only the current session name or email after Welcome, and cover cross-account identity rendering

## Phase 39: Authenticated Home Session and Wallet Repair
- [x] Trace and correct current-session user lookup after OAuth sign-in
- [x] Ensure Home waits for authenticated session identity and requests the matching Neon wallet row
- [x] Add regression coverage for session-to-Home identity and wallet data propagation

## Phase 40: Session Payload Credential Redaction
- [x] Ensure auth.me returns a safe public user object without administrator credential hashes

## Phase 41: Home Wallet Actions
- [x] Connect the Home Add Money button to the existing UPI and 12-digit UTR submission interface
- [x] Connect the Home Withdraw button to the existing UPI withdrawal request interface
- [x] Verify both player form submissions create the correct Neon deposit or withdrawal records
- [x] Add regression coverage for the Home wallet action routes and submission contracts

## Phase 42: Deposit Testing Notice
- [x] Mark deposit payment details as testing-only until a real receiving UPI ID is configured

## Phase 43: Wallet Submission Router Verification
- [x] Add rollback-safe router-level coverage for valid deposit request creation
- [x] Add rollback-safe router-level coverage for valid withdrawal queue creation and winning-balance rules

## Phase 44: Wallet Page Return Navigation
- [x] Add a dark-theme-consistent return-to-dashboard control to the Deposit page
- [x] Add a dark-theme-consistent return-to-dashboard control to the Withdrawal page
- [x] Add regression coverage for both wallet return routes
- [x] Add page-level regression coverage for the Deposit return control
- [x] Add page-level regression coverage for the Withdrawal return control

## Phase 45: Provider-Verified UPI Deposits
- [x] Deferred by owner: connect the Razorpay merchant credentials only when the live release is approved
- [x] Deferred by owner: replace the testing UTR workflow with live provider-backed UPI checkout only after activation approval
- [x] Prepare payment attempts with a unique idempotency key and verified status for future activation
- [x] Prepare signed-event settlement that credits Deposit Balance exactly once after future activation
- [x] Prepare safe failure, cancellation, and duplicate-event handling with automated coverage

## Phase 46: Razorpay-Ready Payment Foundation
- [x] Add a payment-attempt schema compatible with Razorpay orders, payments, and signed webhook events
- [x] Add idempotent payment settlement helpers that credit Deposit Balance exactly once after verification
- [x] Add configuration-ready payment router contracts without activating live Razorpay checkout
- [x] Keep the Deposit page in testing mode with standard responsive page margins until live credentials are set
- [x] Add rollback-safe coverage for payment settlement, duplicate events, and failed payments

## Phase 47: UTR Input Contract Alignment
- [x] Update the Deposit page UTR field to accept exactly 12 numeric digits
- [x] Add a regression test that keeps frontend UTR constraints aligned with server validation

## Phase 48: Admin Owner Session Isolation
- [x] Audit the Admin Panel OAuth entry and callback behavior when a player session already exists
- [x] Create an isolated owner-account sign-in entry that avoids player-session callback conflicts
- [x] Require the owner email and server-verified Admin Panel credentials before rendering dashboard data
- [x] Add regression coverage for owner-only Admin Panel authorization and session-safe login intent

## Phase 49: Admin OAuth Callback Crash Repair
- [x] Analyze the supplied recording and current server logs for the callback failure signature
- [x] Repair the Admin owner OAuth callback route without weakening owner-only access controls
- [x] Add regression coverage for the callback redirect and failure-handling contract

## Phase 50: Owner-Only Profile Admin Navigation
- [x] Show the Profile Admin Panel entry only for rosidulshah4@gmail.com
- [x] Route the owner-only Profile entry to the isolated Admin login path
- [x] Add regression coverage for visibility and route intent

## Phase 51: Interactive Profile Admin Controls
- [x] Make the owner-visible Profile Admin badge route to the isolated Admin login page
- [x] Make the owner-visible Profile Admin Panel action route on tap or click
- [x] Add regression coverage for both interactive Admin controls

## Phase 52: Player Leaderboard and Admin Cycle Management
- [x] Define Neon-backed leaderboard settings, weekly-cycle state, and reward configuration
- [x] Add secure ranking APIs for kills, earnings, matches, and Daily/Weekly/All-Time periods
- [x] Add owner-admin reward configuration and manual weekly-cycle reset controls
- [x] Build the Player Leaderboard page with podium cards, rank badges, filters, stats previews, and personal rank bar
- [x] Add a Player App navigation path to the Leaderboard page
- [x] Add deterministic coverage for ranking, period boundaries, owner-only management, and UI navigation intent

## Phase 53: Admin Return-to-Player Navigation
- [x] Add a prominent Admin Dashboard header action that returns to the Player App in the same tab
- [x] Add regression coverage for the Admin-to-Player navigation route

## Phase 54: Shared Preview Synchronization
- [x] Refresh the development preview from the latest shared project code

## Phase 55: Refer & Earn System
- [x] Define referral settings, code enrollment, eligibility state, and fraud-signal persistence in Neon
- [x] Generate a unique referral code and share link for every player
- [x] Award both users Bonus Coins once after the referred player completes a first valid match join
- [x] Add referral history and referral-code entry experiences to the Player App
- [x] Add same-device and request-origin fraud safeguards with safe reward blocking
- [x] Add owner-admin referral reward settings, referral totals, and fraud-block reporting
- [x] Add deterministic coverage for enrollment, reward idempotency, fraud prevention, and Admin authorization

## Phase 56: Refer & Earn Guidance and Home Discovery
- [x] Add a clear How It Works & Benefits explanation to the player Refer & Earn experience
- [x] Add accessible Referral Rules & Terms disclosures covering eligibility, fair play, fraud blocks, and Bonus Coin conditions
- [x] Add a prominent Home Screen Refer & Earn shortcut that routes directly to the player referral experience
- [x] Add regression coverage for player referral guidance, rules disclosures, and Home navigation intent

## Phase 57: BooyahCraft Brand and Sharing Metadata
- [x] Audit existing product names, page titles, brand logo references, and social metadata
- [x] Create and publish a BooyahCraft logo asset for in-app and social sharing use
- [x] Update player-facing app name and the official Ultimate Free Fire & Esports Tournament Platform tagline
- [x] Update document, Open Graph, and referral-sharing metadata to use the full BooyahCraft social title and logo
- [x] Add regression coverage for brand copy, metadata, referral-preview intent, and logo references

## Phase 58: Compact Player Header
- [x] Remove the official tagline from the Player App’s visible top-header interface
- [x] Render a compact BooyahCraft logo-and-name row in the top-left header area
- [x] Keep the player welcome message and signed-in status as the only header copy below the brand row
- [x] Preserve the official tagline exclusively in HTML and Open Graph sharing metadata
- [x] Add regression coverage for the compact header and metadata-only tagline boundary

## Phase 59: Responsive Player Header Correction
- [x] Add clear responsive separation between the BooyahCraft brand block and Ranks/Profile actions
- [x] Ensure Welcome and signed-in identity text uses responsive sizing and wrapping without truncation
- [x] Add regression coverage for non-overlapping navigation and readable player identity intent

## Phase 60: Home Screen UX Reorganization
- [x] Place Match Categories immediately below the Player Header as the primary Home entry point
- [x] Place the Wallet Balance card directly after Match Categories
- [x] Replace the large Home UTR banner with a compact wallet-focused notice
- [x] Move the Refer & Earn banner to the bottom of the default Home screen
- [x] Add regression coverage for the revised Home content order and wallet notice intent

## Phase 61: Compact Match Category Grid
- [x] Convert Match Categories to a compact two-column grid on Android screens
- [x] Reduce category-card padding while retaining icon, title, and View Matches action clarity
- [x] Ensure all three categories fit within the initial Home viewport with a neat final-row placement
- [x] Add regression coverage for compact grid structure and category interaction intent

## Phase 62: Player Avatar and Numeric UID
- [x] Add persistent avatar URL storage and an owner-only Profile upload contract
- [x] Generate and persist a numeric player UID for every player profile when none exists
- [x] Add tappable Profile avatar upload/edit interaction with safe image validation and preview
- [x] Preserve editing and saving of the player’s Free Fire in-game UID through Edit Free Fire ID
- [x] Add rollback-safe and UI-intent regression coverage for avatar ownership and numeric UID generation

## Phase 63: Cross-App Player Avatar Propagation
- [x] Include saved avatar URLs in leaderboard, tournament-ranking, and participant-list data contracts
- [x] Render custom avatars with initials fallbacks in Player Leaderboard and ranking previews
- [x] Render custom avatars with initials fallbacks in player-visible and Admin participant lists
- [x] Add regression coverage for avatar propagation, protected source ownership, and initials fallbacks

## Phase 64: Withdrawal Experience Refinement
- [x] Surface a prominent 50-Coin minimum withdrawal notice and 24-hour processing expectation
- [x] Clearly show that only Winning Balance can be withdrawn and keep request validation aligned
- [x] Add a protected player withdrawal-history contract without exposing other players’ requests
- [x] Render UPI and Redeem Code withdrawal history with Pending, Approved, Rejected, and Completed state badges
- [x] Add regression coverage for withdrawal eligibility, user-scoped history, and player-facing status intent

## Phase 65: Compact Withdrawal History and FAQ Layout
- [x] Place Withdrawal History directly after the Request Withdrawal action and before FAQs
- [x] Make payout history records expandable with method, status, timestamp, and rejection-detail disclosure
- [x] Convert Withdrawal FAQs into accessible collapsible accordion items
- [x] Add regression coverage for content order and interactive disclosure intent
