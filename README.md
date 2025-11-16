# Lockdown Browser

A secure desktop application that creates a restricted browsing environment for assessments and exams.

## Features

- 🔒 **Full-screen lockdown mode** - Prevents minimizing, closing, or task switching
- ⏰ **Timed sessions** - Automatically closes after specified duration
- 🌐 **Whitelist enforcement** - Only allows access to approved websites
- ⌨️ **Shortcut blocking** - Disables system and browser shortcuts
- 🖥️ **Cross-platform** - Works on Windows and macOS

## Supported Platforms

- Windows 10/11
- macOS 10.14+

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd lockdown-browser

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

# Build distribution packages
npm run dist

# Output will be in the 'release' folder
