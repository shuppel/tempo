# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.0] - 2025-04-17

### Added

- Integrated Replicache for session storage and improved error handling.
- Added ability to unarchive sessions.
- Implemented session debrief modal with sliders and TanStack Query integration.
- Enhanced session metrics with explanations and visual cards.
- Introduced minimalist Brain Dump with helpful tooltip and sample entries.
- Added icon examples and updated timebox configurations.
- Added utility modules for data transformation and storage.
- Implemented Story Mapping & Task Reference System.
- Added pagination and footer components.

### Changed

- Refactored task rollover component to optimize performance and resolve hydration issues.
- Refactored session view and timeline configuration to use a new Icon component.
- Updated UI components with Linear-inspired design, new styles for buttons, cards, dialogs, and inputs.
- Enhanced sessions page with ellipsis menu for actions.
- Refactored session storage and type definitions.
- Centralized type system and enhanced task management.
- Improved progress bar with numeric metrics and visual indicators.
- Enhanced Next Up card visibility with purple flare effect and improved badge styling.
- Converted 'Ready to get started?' message to a popup dialog.
- Updated session debrief modal to use three distinct pages: reflection, feelings, and metrics.
- Updated project files and dependencies.
- Fixed all lint errors and warnings to ensure production readiness.

### Fixed

- Fixed task rollover component render loops and hydration errors.
- Fixed duplicate buttons in session debrief modal.
- Fixed session-debrief functionality.
- Fixed task completion calculation in session metrics.
- Fixed debrief modal to prevent resubmitting completed debriefs.
- Fixed import paths for brain-dump services.
- Fixed consecutive work time limit by adding automatic break insertion.
- Fixed time parsing for flexible formats and improved task matching.
- Fixed AlertCircle icon in StoryCard component.
- Fixed timer edit pencil icon positioning and padding.

### Removed

- Removed redundant button labels from floating timer component.
- Removed metric cards from session progress section.
- Removed unnecessary UI imports from useBrainDump hook.

### Security

- Patched CVE in NextJS.

## [0.1.0] - 2024-05-01

### Added

- Initial release.

## [0.2.1] - 2025-04-21

### Fixed

- Removed unused variables, imports, and type definitions across the codebase.
- Replaced all instances of specific types for improved type safety (no more `any`).
- Updated variable declarations to use `const` where possible (prefer-const).
- Fixed unescaped entity issues in JSX (e.g., quotes and apostrophes).
- Addressed React hook dependency warnings and improved hook usage.
- Cleaned up unused React component imports and props.
- Improved code consistency and maintainability by adhering to lint rules.
- Fixed all lint errors across the codebase for production readiness.
