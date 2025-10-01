# Smart Search Automator Chrome Extension

## Overview

Smart Search Automator is a Chrome browser extension that automates web searches using AI-generated queries. The extension leverages Google's Gemini AI API to create unique, contextual search queries across multiple topics, then simulates human-like browsing behavior including realistic scrolling patterns and timing. Users can configure the number of searches, select topic categories, and monitor automation progress through a real-time logging interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Chrome Extension Architecture

**Extension Type**: Manifest V3 Chrome Extension

The application uses Chrome's modern Manifest V3 architecture with separate components:

- **Service Worker (background.js)**: Handles extension lifecycle events, message passing between components, and tab management
- **Content Script (content.js)**: Injected into all web pages to control scrolling behavior and interact with page content
- **Popup Interface (popup.html/js/css)**: User-facing UI for configuration and control

**Rationale**: Manifest V3 is Chrome's required standard for new extensions, providing better security, performance, and privacy compared to V2.

### Frontend Architecture

**UI Framework**: Vanilla JavaScript with custom CSS

The popup interface is built without frameworks, using:
- Pure DOM manipulation for dynamic updates
- Custom CSS with gradient styling
- Event-driven architecture for user interactions

**Chosen Approach**: Vanilla JS keeps the extension lightweight and fast-loading, critical for browser extensions where bundle size and startup time matter.

**Alternatives Considered**: React/Vue could provide better state management but would significantly increase bundle size and complexity for this relatively simple UI.

### Communication Pattern

**Message Passing System**: Chrome's native `chrome.runtime.onMessage` API

Components communicate through Chrome's built-in message passing:
- Popup → Content Script: Trigger scrolling behavior
- Content Script → Background: Logging and state updates
- All components use async message handling with `sendResponse()`

**Rationale**: Chrome's message passing is the standard and only reliable way for extension components to communicate across different execution contexts.

### State Management

**Storage Solution**: Chrome Storage API (`chrome.storage.local`)

User settings (API key, scroll duration) are persisted using Chrome's storage API rather than localStorage.

**Advantages**:
- Syncs across extension components
- More reliable than localStorage in extension context
- Built-in quota management

### Automation Logic

**Search Generation**: Server-side AI via Gemini API

The extension makes HTTP requests to Google's Gemini AI API to generate unique search queries based on selected topics.

**Human-Like Behavior Simulation**: Time-based randomization

Content script implements realistic scrolling with:
- Variable scroll speeds
- Random direction changes (15% probability)
- Pause intervals (8% probability)
- Speed variations (5% probability)
- Duration-based termination

**Rationale**: Randomized timing and behavior patterns make automation less detectable and more natural-appearing.

### UI/UX Design

**Tag Selection Pattern**: Multi-select button toggles

Topic selection uses clickable tag buttons with visual state (selected/unselected) rather than checkboxes or dropdowns.

**Pros**: More visually appealing, clearer selection state, better use of space
**Cons**: Less conventional than checkboxes

**Progress Feedback**: Real-time logging terminal

A scrollable log terminal shows detailed automation progress with timestamps and action descriptions.

**Rationale**: Transparency in automation builds user trust and aids in debugging.

## External Dependencies

### Third-Party APIs

**Google Gemini AI API**
- **Purpose**: Generate contextual, unique search queries based on topic tags
- **Endpoint**: `https://makersuite.google.com/app/apikey` (for API key generation)
- **Authentication**: API key stored in Chrome Storage
- **Usage**: HTTP requests from popup to generate search queries on-demand

### Chrome Extension APIs

**Core Permissions Required**:
- `tabs`: Create and manage search result tabs
- `scripting`: Inject content scripts for scrolling behavior
- `storage`: Persist user settings (API key, scroll duration)
- `activeTab`: Interact with currently active tab

**Host Permissions**:
- `https://www.google.com/*`: Execute searches on Google
- `<all_urls>`: Inject content script on any page (for scrolling)

### Browser Requirements

- **Chrome Browser**: Manifest V3 compatible (Chrome 88+)
- **Developer Mode**: Required for unpacked extension installation

### Build Dependencies

**None** - The extension uses no build tools, bundlers, or transpilation. All code is vanilla JavaScript compatible with modern Chrome browsers.