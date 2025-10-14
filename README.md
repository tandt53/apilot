# Apilot

**AI-Powered API Testing Desktop Application**

Apilot is a desktop application for API testing and validation powered by AI. Import OpenAPI/Swagger specifications, generate intelligent test cases using AI services, and execute tests with comprehensive assertions and environment management.

## ✨ Key Features

- **📋 Spec Management**: Import and manage OpenAPI 3.x and Swagger 2.0 specifications
- **🤖 AI-Powered Test Generation**: Automatically generate comprehensive test cases using OpenAI, Anthropic, Google Gemini, or local Ollama models
- **🧪 Test Execution**: Execute single tests or multi-step workflow tests with real-time results
- **🌍 Environment Management**: Manage multiple environments with variable substitution per specification
- **✅ Assertions**: Define and validate response assertions with JSONPath support
- **💾 Local Storage**: All data stored locally using IndexedDB (no cloud/server required)
- **🖥️ Desktop App**: Built with Electron for cross-platform support (macOS, Windows, Linux)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Build for all platforms
npm run build

# Platform-specific builds
npm run build:mac
npm run build:win
npm run build:linux
```

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + TailwindCSS
- **Desktop Framework**: Electron 38
- **Database**: IndexedDB (via Dexie.js)
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI
- **AI Services**: OpenAI, Anthropic Claude, Google Gemini, Ollama
- **Build Tool**: Vite

## 📖 Application Structure

```
apilot-app/
├── electron/            # Electron main process
│   ├── main.ts         # Main process entry point
│   └── preload.ts      # Context bridge (IPC)
├── src/
│   ├── pages/          # Application pages
│   │   ├── Specs.tsx      # API Specifications list
│   │   ├── SpecDetail.tsx # Spec details & test generation
│   │   ├── Tests.tsx      # Test cases management
│   │   └── Settings.tsx   # Application settings
│   ├── components/     # Reusable React components
│   ├── lib/
│   │   ├── ai/           # AI service integrations
│   │   ├── api/          # IndexedDB operations (Dexie)
│   │   ├── converters/   # OpenAPI/Postman converters
│   │   ├── executor/     # Test execution engine
│   │   ├── hooks/        # React Query hooks
│   │   └── db.ts         # Database schema
│   └── types/          # TypeScript type definitions
└── docs/               # Detailed documentation
```

## 🎯 Core Concepts

### Specifications (Specs)
OpenAPI/Swagger JSON files that define your API endpoints, parameters, request/response schemas.

### Test Cases
Individual test scenarios generated from specs or created manually:
- **Single Tests**: Test a single API endpoint
- **Workflow Tests**: Multi-step tests that chain multiple endpoints with variable extraction

### Environments
Per-specification variable sets for different deployment stages:
- Base URLs
- Authentication tokens
- Dynamic test data
- Variable substitution using `{{variableName}}` syntax

### Assertions
Validation rules that verify API responses:
- Status code checks
- Response time validation
- JSONPath field assertions
- Header verification
- Body content matching

## 🔄 Workflow

1. **Import Spec** → Upload OpenAPI/Swagger JSON file
2. **Generate Tests** → Select endpoints and use AI to generate test cases
3. **Configure Environment** → Set up per-spec variables
4. **Execute Tests** → Run tests and view real-time results
5. **Refine** → Edit tests, add assertions, adjust parameters

## 🤖 AI Test Generation

Supports multiple AI providers (configured in Settings):

- **OpenAI** (GPT-4, GPT-4 Turbo, GPT-3.5)
- **Anthropic** (Claude 3.5 Sonnet, Opus, Haiku)
- **Google Gemini** (2.0 Flash, 1.5 Pro)
- **Ollama** (Local models: Llama, Mistral, etc.)

Tests are generated based on:
- Endpoint specifications and schemas
- Request/response examples
- Common API testing patterns (positive & negative cases)
- Workflow analysis for multi-step scenarios

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

## 💬 Support

For issues, questions, or contributions, please [create an issue](https://github.com/tandt53/apilot/issues).
