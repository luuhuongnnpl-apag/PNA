# Trung tâm Cố vấn học tập

Internal project: PNA. Public-facing brand: Trung tâm Cố vấn học tập / Academic Advising Center. No Phúc Nguyên or institutional logo. Independent advising support tool, not an official institutional portal unless authorized.

## Architecture
React + TypeScript PWA; separate Firebase project; Auth, Firestore, Hosting, Storage and Functions. Default deny access. No real student data until authorization and security testing.

## Product charter
Two axes: organizational governance and student lifecycle from admission through graduation. Students are active managers of their own goals, plans and progress. Closed feedback loop: plan, inform, execute, monitor, respond, improve.

## Engines
Governance: organization, scoped roles, term-limited delegation, audit. Lifecycle: cohorts, curriculum versions, academic years, semesters, individual progression, historical snapshots. Knowledge: versioned regulations, applicability, sources. Workflow: reusable campaigns, forms, tasks, approvals, conduct and retake requests. Distribution: audience by cohort, class, program, stage and individual; publication and receipt records. Intelligence: source-grounded advising, human review. Feedback: private cases, suggestions, resolution and aggregate improvement. Personal management: goals, calendar, portfolio and self-review, private by default.

## Data and safety
Separate official, advisor-verified and student-reported records. No cross-class access by default. Class officers see only assigned task data; no default access to grades or confidential cases. Authorization enforced server-side and in Firebase rules. Version policies and preserve historical applicability. No credentials or student records in GitHub. PNL/PND integrations via authorized APIs only; no shared write access.

## Roadmap
0.1 foundation and access control; 0.2 organization and cohorts; 0.3 lifecycle; 0.4 knowledge and live feed; 0.5 campaigns and workflows; 0.6 personal management and feedback; 0.7 AI and integrations; 0.8 security and acceptance tests; 1.0 production. Institutional policies and academic calendar require verification. No production deployment until Firebase project and access are configured.
