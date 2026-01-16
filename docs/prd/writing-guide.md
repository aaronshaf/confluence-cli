# PRD Writing Guide

A well-crafted PRD bridges customer problems and product solutions. This guide synthesizes best practices to help you write PRDs that drive alignment and outcomes.

## Core Principle

**Spend more time on the problem than feels comfortable.** Jumping to solutions before understanding problems is the most common PRD failure mode.

## Essential Components

Every PRD should follow this logical flow: **why** (purpose and problem), **who** (users), **what** (features and scope), **how** (requirements and designs), **when** (timeline), and **how we'll know** (success metrics).

### Problem Statement and Context

Answer why the product should exist, what customer pain points it addresses, and how it connects to strategy.

- Include quantitative evidence (behavioral data, financial metrics)
- Include qualitative evidence (direct user quotes, interview insights)
- Be specific: "38% of NPS detractors cite courses as too slow" beats "users want better experiences"

### Target Audience

Define who you're building for with specific user segments, their needs, pain points, motivations, and behaviors. Distinguish primary personas (end users) from secondary personas (decision makers, administrators).

### Goals, Success Metrics, and Scope

Use SMART goals with specific quantifiable targets:
- Good: "80% of users complete onboarding within 10 minutes"
- Bad: "improve onboarding"

**Critical: Include a non-goals section.** Explicitly state what you're NOT building to prevent scope creep and late-stage conflicts.

### Features and Requirements

Express requirements through user stories with testable acceptance criteria:
```
As a [user], I want to [action] so I can [benefit]

Given [context]
When [action]
Then [expected outcome]
```

Prioritize using MoSCoW (Must/Should/Could/Won't) or similar frameworks. Include non-functional requirements: performance benchmarks, security standards, scalability, accessibility.

### User Flows and Designs

Visualize how users will interact with the product. Even rough sketches help align teams before high-fidelity designs. Embed wireframes, mockups, or link to Figma files.

### Timeline, Dependencies, and Risks

- Identify cross-team dependencies
- Document technical constraints
- List potential risks with mitigation strategies
- Keep milestones to three phases maximum

### Open Questions and Change Log

Maintain an open questions section for unknowns requiring resolution. Track document evolution with a change log showing dates, decisions, and rationale.

## Writing Principles

### Be Ruthlessly Specific

- Bad: "the product should be lightweight"
- Good: "under 500g including battery"

- Bad: "fast loading time"
- Good: "page loads in under 2 seconds on 4G connections"

Vague requirements leave teams guessing. Name specific actions, outcomes, or behaviors.

### Separate Goals from Requirements

- Goal: "Help users complete onboarding faster" (provides context)
- Requirement: "Reduce required fields from eight to four" (can be implemented)

Keep goals at the top as context; requirements as specific implementation steps below.

### Describe What, Not How

Specify the desired outcome and constraints, not implementation details. Let engineers determine technical approach and designers explore experience.

Your job: paint the target clearly. Their job: figure out how to hit it.

### Write to Excite, Not Just to Document

Modern PRDs should inspire teams to build. Include:
- Customer quotes
- Competitive screenshots
- Compelling data that makes the problem feel urgent

PRDs should read like blog posts that contain all necessary information.

### Keep It Short

Fight the urge to over-document. The longer the document, the less it gets read. Use links to reference supporting materials rather than embedding everything.

Structure for scanning—most readers only need sections relevant to their role.

## Tailoring for Stakeholders

### For Engineering
- Clear functional requirements with acceptance criteria
- Technical constraints and dependencies
- Edge cases and error handling
- Avoid prescribing implementation while providing enough detail for estimation

### For Design
- User personas and problem context
- User research findings and customer feedback
- Rough wireframes as starting points
- Leave room for UX exploration

### For Leadership
- Strategic alignment and business impact
- Success metrics with targets
- ROI projections
- Competitive positioning

### For QA
- Measurable, testable acceptance criteria
- Boundary conditions and error states
- Non-functional requirements for validation

**Use progressive disclosure:** Start high-level and get granular. Use clear section headers for navigation. Link to detailed specs rather than embedding everything.

## Common Pitfalls to Avoid

### Writing PRDs Instead of Doing Discovery

PRDs should document the **results of discovery**, not replace it. Write PRDs after customer validation, not before.

### Missing or Vague Success Metrics

"Increase engagement" or "improve satisfaction" without specific targets invites subjective debates. If you can't quantify success, hold off until you can.

### Skipping the Non-Goals Section

Without explicit boundaries, stakeholders assume everything is in scope. Always document: "What are we NOT building this quarter?"

### Treating PRDs as Static Documents

Make PRDs living documents using collaborative tools with version control. Log changes with dates, owners, and rationale.

### Over-Documentation and Under-Documentation

Too little detail means different assumptions. Too much detail means nobody reads it. Match detail level to project complexity.

### Writing in Isolation

Involve engineering and design early. One review with each function catches problems before they compound.

### Excessive Delegation

Create rough mockups yourself. Work through edge cases. The PRD should show proof of work—customer evidence, competitive analysis, specific data.

## What Good PRDs Look Like

Effective PRDs share these traits:
- Make readers care about the problem before presenting solutions
- Include enough customer evidence that the problem feels urgent
- Define success specifically enough that everyone will know if it worked
- Remain living documents that evolve with the product

**The goal isn't comprehensive documentation—it's alignment that enables great products.**

The right PRD isn't the most thorough; it's the one your team will actually use to build something customers love.
